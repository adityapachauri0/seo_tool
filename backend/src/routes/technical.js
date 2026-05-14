const express = require('express');
const router = express.Router();
const Audit = require('../models/Audit');
const Project = require('../models/Project');
const {
  checkLinks,
  generateSchemaMarkup,
  generateSitemap,
  checkRedirects,
  findOrphanPages,
  findDuplicateTitles,
  findDuplicateDescriptions,
} = require('../services/technicalSeo');

// POST /api/technical/broken-links/:projectId — check all links for broken ones
router.post('/broken-links/:projectId', async (req, res, next) => {
  try {
    const audits = await Audit.find({ projectId: req.params.projectId })
      .sort({ crawledAt: -1 })
      .limit(50);

    // Collect all unique external URLs
    const allLinks = new Set();
    for (const audit of audits) {
      const external = audit.links?.external || [];
      const internal = audit.links?.internal || [];
      for (const link of [...external, ...internal]) {
        const url = link.url || link.href;
        if (url && url.startsWith('http')) allLinks.add(url);
      }
    }

    const urls = Array.from(allLinks).slice(0, 200); // limit to 200 checks
    const results = await checkLinks(urls);

    const broken = results.filter(r => !r.ok);
    const ok = results.filter(r => r.ok);

    res.json({
      totalChecked: results.length,
      broken: broken.length,
      ok: ok.length,
      brokenLinks: broken,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/technical/schema/:projectId — schema markup analysis and suggestions
router.get('/schema/:projectId', async (req, res, next) => {
  try {
    const audits = await Audit.find({ projectId: req.params.projectId })
      .sort({ crawledAt: -1 })
      .limit(50);

    const results = audits.map(audit => {
      const existingSchema = audit.schema;
      const suggestions = generateSchemaMarkup(audit);

      return {
        url: audit.url,
        title: audit.meta?.title?.value || '',
        hasSchema: !!existingSchema,
        existingSchema,
        suggestions,
      };
    });

    const withSchema = results.filter(r => r.hasSchema).length;
    const withoutSchema = results.filter(r => !r.hasSchema).length;

    res.json({
      totalPages: results.length,
      withSchema,
      withoutSchema,
      pages: results,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/technical/schema/generate/:auditId — generate schema for specific page
router.get('/schema/generate/:auditId', async (req, res, next) => {
  try {
    const audit = await Audit.findById(req.params.auditId);
    if (!audit) return res.status(404).json({ error: 'Audit not found' });

    const suggestions = generateSchemaMarkup(audit);
    res.json({ url: audit.url, suggestions });
  } catch (err) {
    next(err);
  }
});

// GET /api/technical/sitemap/:projectId — generate XML sitemap
router.get('/sitemap/:projectId', async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const audits = await Audit.find({ projectId: req.params.projectId }).sort({
      crawledAt: -1,
    });

    // Deduplicate by URL (keep latest)
    const urlMap = {};
    for (const audit of audits) {
      if (!urlMap[audit.url]) urlMap[audit.url] = audit;
    }

    const xml = generateSitemap(Object.values(urlMap), project.domain, project.protocol);

    if (req.query.format === 'json') {
      res.json({ pages: Object.keys(urlMap).length, sitemap: xml });
    } else {
      res.set('Content-Type', 'application/xml');
      res.send(xml);
    }
  } catch (err) {
    next(err);
  }
});

// POST /api/technical/redirects/:projectId — check for redirect chains
router.post('/redirects/:projectId', async (req, res, next) => {
  try {
    const audits = await Audit.find({ projectId: req.params.projectId })
      .sort({ crawledAt: -1 })
      .limit(50);

    // Collect all internal URLs
    const urls = [...new Set(audits.map(a => a.url))];
    const results = await checkRedirects(urls.slice(0, 50));

    const chains = results.filter(r => r.issue === 'redirect_chain');
    const redirects = results.filter(r => r.issue === 'redirect');

    res.json({
      totalChecked: urls.length,
      chains: chains.length,
      redirects: redirects.length,
      issues: results.filter(r => r.issue !== 'redirect' || r.hops > 1),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/technical/orphans/:projectId — find orphan pages
router.get('/orphans/:projectId', async (req, res, next) => {
  try {
    const audits = await Audit.find({ projectId: req.params.projectId })
      .sort({ crawledAt: -1 })
      .limit(50);

    const orphans = findOrphanPages(audits);
    res.json({ totalPages: audits.length, orphanPages: orphans.length, orphans });
  } catch (err) {
    next(err);
  }
});

// GET /api/technical/duplicates/:projectId — find duplicate titles and descriptions
router.get('/duplicates/:projectId', async (req, res, next) => {
  try {
    const audits = await Audit.find({ projectId: req.params.projectId })
      .sort({ crawledAt: -1 })
      .limit(100);

    const dupTitles = findDuplicateTitles(audits);
    const dupDescs = findDuplicateDescriptions(audits);

    res.json({
      duplicateTitles: dupTitles,
      duplicateDescriptions: dupDescs,
      totalDupTitles: dupTitles.length,
      totalDupDescriptions: dupDescs.length,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/technical/overview/:projectId — full technical SEO overview
router.get('/overview/:projectId', async (req, res, next) => {
  try {
    const audits = await Audit.find({ projectId: req.params.projectId })
      .sort({ crawledAt: -1 })
      .limit(50);

    const orphans = findOrphanPages(audits);
    const dupTitles = findDuplicateTitles(audits);
    const dupDescs = findDuplicateDescriptions(audits);
    const withSchema = audits.filter(a => a.schema).length;
    const missingMeta = audits.filter(
      a => !a.meta?.title?.value || !a.meta?.description?.value
    ).length;
    const missingH1 = audits.filter(a => !a.headings?.h1?.length).length;
    const missingCanonical = audits.filter(a => !a.meta?.canonical).length;
    const missingOg = audits.filter(a => !a.meta?.ogTags?.title).length;

    // Calculate tech health score
    const totalPages = audits.length || 1;
    const issues = {
      orphanPages: orphans.length,
      duplicateTitles: dupTitles.reduce((sum, d) => sum + d.count, 0),
      duplicateDescriptions: dupDescs.reduce((sum, d) => sum + d.count, 0),
      missingSchema: totalPages - withSchema,
      missingMeta,
      missingH1,
      missingCanonical,
      missingOg,
    };

    const totalIssues = Object.values(issues).reduce((sum, v) => sum + v, 0);
    const maxPossibleIssues = totalPages * 8; // 8 checks per page
    const techScore = Math.round(
      Math.max(0, 100 - (totalIssues / maxPossibleIssues) * 100)
    );

    res.json({
      techScore,
      totalPages,
      issues,
      summary: {
        schemaAdoption: `${withSchema}/${totalPages} pages`,
        orphanPages: orphans.length,
        duplicateTitles: dupTitles.length + ' groups',
        duplicateDescriptions: dupDescs.length + ' groups',
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
