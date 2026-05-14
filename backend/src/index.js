require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const projectRoutes = require('./routes/projects');
const auditRoutes = require('./routes/audits');
const dashboardRoutes = require('./routes/dashboard');
const competitorRoutes = require('./routes/competitors');
const keywordRoutes = require('./routes/keywords');
const contentRoutes = require('./routes/content');
const technicalRoutes = require('./routes/technical');
const reportsRoutes = require('./routes/reports');
const { startScheduler } = require('./crons/scheduler');

const app = express();
const PORT = process.env.PORT || 4800;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/seo_command_center';

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));

// Routes
app.use('/api/projects', projectRoutes);
app.use('/api/audits', auditRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/competitors', competitorRoutes);
app.use('/api/keywords', keywordRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/technical', technicalRoutes);
app.use('/api/reports', reportsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Error handling middleware
app.use((err, req, res, _next) => {
  console.error('[ERROR]', err.message);

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ error: 'Validation failed', details: messages });
  }

  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({ error: `Duplicate value for "${field}"` });
  }

  res.status(500).json({ error: 'Internal server error' });
});

// Connect to MongoDB and start server
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('[DB] Connected to MongoDB');

    startScheduler();

    app.listen(PORT, () => {
      console.log(`[SERVER] SEO Command Center backend running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[DB] MongoDB connection failed:', err.message);
    process.exit(1);
  });
