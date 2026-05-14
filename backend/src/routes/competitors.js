const express = require('express');
const router = express.Router();
const axios = require('axios');
const Competitor = require('../models/Competitor');
const Project = require('../models/Project');
const { detectTechStack } = require('../services/techDetector');

const CRAWLER_URL = process.env.CRAWLER_URL || 'http://localhost:4801';

// GET /api/competitors/:projectId — list competitors for a project
router.get('/:projectId', async (req, res, next) => {
  try {
    const competitors = await Competitor.find({
      projectId: req.params.projectId,
    }).sort({ createdAt: -1 });

    res.json({ competitors });
  } catch (err) {
    next(err);
  }
});

// POST /api/competitors/:projectId — add a competitor
router.post('/:projectId', async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { domain, name } = req.body;
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    // Normalize domain — strip protocol and trailing slash
    const cleanDomain = domain
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, '')
      .toLowerCase()
      .trim();

    if (!cleanDomain) {
      return res.status(400).json({ error: 'Invalid domain' });
    }

    const competitor = await Competitor.create({
      projectId: req.params.projectId,
      domain: cleanDomain,
      name: name || cleanDomain,
    });

    res.status(201).json({ competitor });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'This competitor is already added to the project' });
    }
    next(err);
  }
});

// DELETE /api/competitors/remove/:id — remove a competitor
router.delete('/remove/:id', async (req, res, next) => {
  try {
    const competitor = await Competitor.findByIdAndDelete(req.params.id);
    if (!competitor) {
      return res.status(404).json({ error: 'Competitor not found' });
    }
    res.json({ message: 'Competitor removed' });
  } catch (err) {
    next(err);
  }
});

// POST /api/competitors/audit/:id — trigger audit of competitor site
router.post('/audit/:id', async (req, res, next) => {
  try {
    const competitor = await Competitor.findById(req.params.id);
    if (!competitor) {
      return res.status(404).json({ error: 'Competitor not found' });
    }

    const url = `https://${competitor.domain}`;

    let crawlResult;
    try {
      const response = await axios.post(`${CRAWLER_URL}/crawl/page`, { url });
      crawlResult = response.data;
    } catch (crawlErr) {
      if (crawlErr.code === 'ECONNREFUSED') {
        return res.status(503).json({ error: 'Crawler service is unavailable' });
      }
      if (crawlErr.response) {
        return res.status(crawlErr.response.status).json({
          error: 'Crawler service error',
          details: crawlErr.response.data,
        });
      }
      throw crawlErr;
    }

    // Extract page data from crawler result
    const pageData = crawlResult.page || crawlResult;
    const score = pageData.score ?? pageData.seoScore ?? null;

    // Update competitor with audit results
    const pageEntry = {
      url,
      title: pageData.meta?.title || pageData.title || '',
      score: score,
      crawledAt: new Date(),
    };

    // Keep last 50 pages max
    const existingPages = competitor.pages || [];
    const updatedPages = [pageEntry, ...existingPages].slice(0, 50);

    competitor.lastAuditScore = score;
    competitor.lastAuditAt = new Date();
    competitor.pages = updatedPages;

    await competitor.save();

    res.json({
      message: 'Audit completed',
      competitor,
      auditResult: pageData,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/competitors/compare/:projectId — side-by-side comparison
router.get('/compare/:projectId', async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const competitors = await Competitor.find({
      projectId: req.params.projectId,
      status: 'active',
    });

    const yourSite = {
      domain: project.domain,
      name: project.name,
      score: project.lastScore || 0,
      isOwner: true,
    };

    const comparison = competitors.map((c) => ({
      id: c._id,
      domain: c.domain,
      name: c.name || c.domain,
      score: c.lastAuditScore || 0,
      pagesCount: (c.pages || []).length,
      commonKeywords: c.commonKeywords || 0,
      keywordGaps: c.keywordGaps || 0,
      backlinks: c.backlinks || 0,
      techStack: c.techStack || {},
      lastAuditAt: c.lastAuditAt,
    }));

    res.json({
      yourSite,
      competitors: comparison,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/competitors/pages/:id — get crawled pages for a competitor
router.get('/pages/:id', async (req, res, next) => {
  try {
    const competitor = await Competitor.findById(req.params.id);
    if (!competitor) {
      return res.status(404).json({ error: 'Competitor not found' });
    }

    res.json({
      domain: competitor.domain,
      pages: competitor.pages || [],
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/competitors/detect-tech/:id — detect tech stack
router.post('/detect-tech/:id', async (req, res, next) => {
  try {
    const competitor = await Competitor.findById(req.params.id);
    if (!competitor) {
      return res.status(404).json({ error: 'Competitor not found' });
    }

    const url = `https://${competitor.domain}`;

    let html = '';
    let headers = {};
    try {
      const response = await axios.get(url, {
        timeout: 15000,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'SEOCommandCenter/1.0 (TechDetector)',
        },
        validateStatus: (status) => status < 500,
      });
      html = typeof response.data === 'string' ? response.data : '';
      headers = response.headers || {};
    } catch (fetchErr) {
      if (fetchErr.code === 'ECONNREFUSED' || fetchErr.code === 'ENOTFOUND') {
        return res.status(502).json({ error: `Could not reach ${competitor.domain}` });
      }
      return res.status(502).json({ error: `Failed to fetch ${competitor.domain}: ${fetchErr.message}` });
    }

    const techStack = await detectTechStack(html, headers);

    competitor.techStack = techStack;
    await competitor.save();

    res.json({
      message: 'Tech stack detected',
      domain: competitor.domain,
      techStack,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
