const express = require('express');
const router = express.Router();
const axios = require('axios');
const Project = require('../models/Project');
const Audit = require('../models/Audit');
const AuditSummary = require('../models/AuditSummary');

const CRAWLER_URL = process.env.CRAWLER_URL || 'http://localhost:4801';

// POST /api/audits/run/:projectId — trigger a crawl
router.post('/run/:projectId', async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.status === 'archived') {
      return res.status(400).json({ error: 'Cannot crawl an archived project' });
    }

    const crawlResponse = await axios.post(`${CRAWLER_URL}/crawl/site`, {
      url: `${project.protocol}://${project.domain}`,
      projectId: project._id,
    });

    res.json({
      message: 'Crawl triggered',
      job: crawlResponse.data,
    });
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json({
        error: 'Crawler service error',
        details: err.response.data,
      });
    }
    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'Crawler service is unavailable' });
    }
    next(err);
  }
});

// POST /api/audits/webhook — receives completed audit data from crawler
router.post('/webhook', async (req, res, next) => {
  try {
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (webhookSecret && req.headers['x-webhook-secret'] !== webhookSecret) {
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }

    const { projectId, pages, duration } = req.body;

    if (!projectId || !pages || !Array.isArray(pages)) {
      return res.status(400).json({ error: 'Invalid webhook payload: projectId and pages[] are required' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Prevent duplicates on retry
    await Audit.deleteMany({
      projectId,
      crawledAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
    });

    // Save each page as an Audit document
    const auditDocs = await Audit.insertMany(
      pages.map((page) => ({
        projectId,
        url: page.url,
        score: page.score,
        issues: page.issues || [],
        meta: page.meta || {},
        headings: page.headings || {},
        links: page.links || {},
        images: page.images || [],
        schema: page.schema || page.schema_data || null,
        performance: page.performance || {},
        content: page.content || {},
        crawledAt: new Date(),
      }))
    );

    // Calculate summary stats
    const scores = pages.filter((p) => typeof p.score === 'number').map((p) => p.score);
    const avgScore = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : 0;

    // Count issues by type
    const issuesByType = {};
    for (const page of pages) {
      if (page.issues && Array.isArray(page.issues)) {
        for (const issue of page.issues) {
          const key = issue.type || 'unknown';
          if (!issuesByType[key]) {
            issuesByType[key] = { critical: 0, warning: 0, info: 0, total: 0 };
          }
          const severity = issue.severity || 'info';
          issuesByType[key][severity] = (issuesByType[key][severity] || 0) + 1;
          issuesByType[key].total += 1;
        }
      }
    }

    // Create AuditSummary
    const summary = await AuditSummary.create({
      projectId,
      totalPages: pages.length,
      avgScore,
      issuesByType,
      scoreHistory: [{ date: new Date(), score: avgScore }],
      crawlDuration: duration || 0,
      crawledAt: new Date(),
    });

    // Update project
    await Project.findByIdAndUpdate(projectId, {
      lastCrawlAt: new Date(),
      lastScore: avgScore,
    });

    // Check for alert conditions
    try {
      const { checkAlerts } = require('../services/reportGenerator');
      await checkAlerts(projectId);
    } catch (alertErr) {
      console.error('[ALERT] Failed to check alerts:', alertErr.message);
    }

    res.json({
      message: 'Audit data saved',
      auditsCreated: auditDocs.length,
      summaryId: summary._id,
      avgScore,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/audits/page/:auditId — get single audit by ID
router.get('/page/:auditId', async (req, res, next) => {
  try {
    const audit = await Audit.findById(req.params.auditId);
    if (!audit) {
      return res.status(404).json({ error: 'Audit not found' });
    }
    res.json(audit);
  } catch (err) {
    next(err);
  }
});

// GET /api/audits/:projectId/latest — get the latest AuditSummary
router.get('/:projectId/latest', async (req, res, next) => {
  try {
    const summary = await AuditSummary.findOne({ projectId: req.params.projectId })
      .sort({ crawledAt: -1 });

    if (!summary) {
      return res.status(404).json({ error: 'No audit summary found for this project' });
    }

    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// GET /api/audits/:projectId — list audits for project, paginated
router.get('/:projectId', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [audits, total] = await Promise.all([
      Audit.find({ projectId: req.params.projectId })
        .sort({ crawledAt: -1 })
        .skip(skip)
        .limit(limit),
      Audit.countDocuments({ projectId: req.params.projectId }),
    ]);

    res.json({
      audits,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
