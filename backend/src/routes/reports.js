const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const Alert = require('../models/Alert');
const Project = require('../models/Project');
const { generateReport, checkAlerts, formatReportText } = require('../services/reportGenerator');

// POST /api/reports/generate/:projectId — generate a report
router.post('/generate/:projectId', async (req, res, next) => {
  try {
    const { type = 'custom' } = req.body;
    const report = await generateReport(req.params.projectId, type);
    if (!report) return res.status(404).json({ error: 'No audit data available for report' });
    res.json(report);
  } catch (err) { next(err); }
});

// GET /api/reports/alerts/count/:projectId — get unread alert count
// NOTE: This route must be defined BEFORE the /:projectId catch-all below
router.get('/alerts/count/:projectId', async (req, res, next) => {
  try {
    const count = await Alert.countDocuments({ projectId: req.params.projectId, read: false });
    res.json({ unreadCount: count });
  } catch (err) { next(err); }
});

// GET /api/reports/alerts/:projectId — list alerts for a project
router.get('/alerts/:projectId', async (req, res, next) => {
  try {
    const { unread } = req.query;
    const filter = { projectId: req.params.projectId };
    if (unread === 'true') filter.read = false;

    const alerts = await Alert.find(filter)
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Alert.countDocuments({ projectId: req.params.projectId, read: false });

    res.json({ alerts, unreadCount });
  } catch (err) { next(err); }
});

// PUT /api/reports/alerts/read/:alertId — mark alert as read
router.put('/alerts/read/:alertId', async (req, res, next) => {
  try {
    await Alert.findByIdAndUpdate(req.params.alertId, { read: true });
    res.json({ message: 'Alert marked as read' });
  } catch (err) { next(err); }
});

// PUT /api/reports/alerts/read-all/:projectId — mark all alerts as read
router.put('/alerts/read-all/:projectId', async (req, res, next) => {
  try {
    await Alert.updateMany({ projectId: req.params.projectId, read: false }, { read: true });
    res.json({ message: 'All alerts marked as read' });
  } catch (err) { next(err); }
});

// GET /api/reports/detail/:reportId — get single report
router.get('/detail/:reportId', async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.reportId);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const project = await Project.findById(report.projectId);
    const plainText = formatReportText(report, project?.name || 'Unknown');

    res.json({ report, plainText });
  } catch (err) { next(err); }
});

// GET /api/reports/:projectId — list reports for a project
router.get('/:projectId', async (req, res, next) => {
  try {
    const reports = await Report.find({ projectId: req.params.projectId })
      .sort({ generatedAt: -1 })
      .limit(20);
    res.json(reports);
  } catch (err) { next(err); }
});

module.exports = router;
