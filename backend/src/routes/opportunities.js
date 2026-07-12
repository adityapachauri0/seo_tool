const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const Audit = require('../models/Audit');
const { getOpportunities } = require('../services/opportunities');
const { generateMetaTags } = require('../services/aiContentEngine');
const { fetchSearchAnalytics, getSiteList } = require('../services/searchConsole');
const { matchProperty } = require('../services/rankTracker');

// GET /api/opportunities/:projectId — striking-distance + CTR-fix lists
router.get('/:projectId', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days || '90', 10);
    const minImpressions = parseInt(req.query.minImpressions || '30', 10);
    const opps = await getOpportunities(req.params.projectId, { days, minImpressions });
    res.json(opps);
  } catch (err) { next(err); }
});

// POST /api/opportunities/:projectId/ctr-fix — { keyword } →
// find the page ranking for that query, generate rewritten title/meta for it
router.post('/:projectId/ctr-fix', async (req, res, next) => {
  try {
    const { keyword } = req.body;
    if (!keyword) return res.status(400).json({ error: 'keyword required' });

    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const property = matchProperty(await getSiteList(), project.domain);
    if (!property) return res.status(400).json({ error: 'No Search Console access for this domain' });

    const { rows, error } = await fetchSearchAnalytics(property, {
      dimensions: ['page'],
      rowLimit: 1,
      filters: [{ dimension: 'query', operator: 'equals', expression: keyword }],
    });
    if (error) return res.status(502).json({ error });
    if (rows.length === 0) return res.status(404).json({ error: 'No ranking page found for this query' });

    const pageUrl = rows[0].keys[0];
    const audit = await Audit.findOne({ projectId: project._id, url: pageUrl }).sort({ crawledAt: -1 });

    const suggestions = await generateMetaTags(
      pageUrl,
      audit?.meta?.title?.value || '',
      null,
      keyword
    );

    res.json({
      keyword,
      page: pageUrl,
      current: audit?.meta || null,
      suggestions,
    });
  } catch (err) { next(err); }
});

module.exports = router;
