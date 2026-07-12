const express = require('express');
const router = express.Router();
const LinkOpportunity = require('../models/LinkOpportunity');
const Project = require('../models/Project');
const { sweepProject } = require('../services/linkOpportunities');

// GET /api/link-opportunities/:projectId — list (non-ignored by default)
router.get('/:projectId', async (req, res, next) => {
  try {
    const filter = { projectId: req.params.projectId };
    filter.status = req.query.status ? req.query.status : { $ne: 'ignored' };
    const opps = await LinkOpportunity.find(filter).sort({ foundAt: -1 }).limit(200);
    res.json(opps);
  } catch (err) { next(err); }
});

// POST /api/link-opportunities/:projectId/sweep — run a sweep now
router.post('/:projectId/sweep', async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const result = await sweepProject(project);
    res.json(result);
  } catch (err) { next(err); }
});

// PUT /api/link-opportunities/item/:id — update status
router.put('/item/:id', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['new', 'contacted', 'done', 'ignored'].includes(status)) {
      return res.status(400).json({ error: 'invalid status' });
    }
    const opp = await LinkOpportunity.findByIdAndUpdate(
      req.params.id, { status }, { new: true }
    );
    if (!opp) return res.status(404).json({ error: 'Not found' });
    res.json(opp);
  } catch (err) { next(err); }
});

module.exports = router;
