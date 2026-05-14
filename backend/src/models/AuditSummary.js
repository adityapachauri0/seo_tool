const mongoose = require('mongoose');

const auditSummarySchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true,
  },
  totalPages: {
    type: Number,
  },
  avgScore: {
    type: Number,
  },
  issuesByType: {
    type: mongoose.Schema.Types.Mixed,
  },
  scoreHistory: [
    {
      date: Date,
      score: Number,
    },
  ],
  crawlDuration: {
    type: Number,
  },
  crawledAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('AuditSummary', auditSummarySchema);
