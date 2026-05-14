const express = require('express');
const router = express.Router();
const Project = require('../models/Project');

// GET /api/projects — list all projects, sorted by updatedAt desc
router.get('/', async (req, res, next) => {
  try {
    const projects = await Project.find().sort({ updatedAt: -1 });
    res.json(projects);
  } catch (err) {
    next(err);
  }
});

// POST /api/projects — create project
router.post('/', async (req, res, next) => {
  try {
    const { name, domain, protocol, tags, crawlFrequency } = req.body;

    const existing = await Project.findOne({ domain: domain?.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'A project with this domain already exists' });
    }

    const project = await Project.create({
      name,
      domain,
      protocol,
      tags,
      crawlFrequency,
    });

    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:id — get single project
router.get('/:id', async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (err) {
    next(err);
  }
});

// PUT /api/projects/:id — update project
router.put('/:id', async (req, res, next) => {
  try {
    const { name, domain, protocol, status, tags, crawlFrequency } = req.body;

    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { name, domain, protocol, status, tags, crawlFrequency },
      { new: true, runValidators: true }
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/projects/:id — soft delete (set status: archived)
router.delete('/:id', async (req, res, next) => {
  try {
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { status: 'archived' },
      { new: true }
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ message: 'Project archived', project });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
