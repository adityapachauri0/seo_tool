const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const AuditSummary = require('../models/AuditSummary');

// GET /api/dashboard — all active projects with lastScore and lastCrawlAt
router.get('/', async (req, res, next) => {
  try {
    const projects = await Project.find({ status: 'active' })
      .select('name domain protocol status tags crawlFrequency lastCrawlAt lastScore updatedAt')
      .sort({ updatedAt: -1 });

    res.json(projects);
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/:projectId/trend — scoreHistory from last 10 AuditSummaries
router.get('/:projectId/trend', async (req, res, next) => {
  try {
    const summaries = await AuditSummary.find({ projectId: req.params.projectId })
      .sort({ crawledAt: -1 })
      .limit(10)
      .select('avgScore crawledAt scoreHistory');

    const trend = summaries
      .reverse()
      .map((s) => ({
        date: s.crawledAt,
        score: s.avgScore,
      }));

    res.json({ projectId: req.params.projectId, trend });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
