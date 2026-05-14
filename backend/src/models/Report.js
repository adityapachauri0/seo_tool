const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  type: { type: String, enum: ['weekly', 'monthly', 'custom', 'alert'], default: 'weekly' },
  period: { start: Date, end: Date },
  data: {
    overallScore: Number,
    scoreChange: Number,
    totalPages: Number,
    issuesSummary: { critical: Number, warning: Number, info: Number },
    topIssues: [{ type: String, count: Number, severity: String }],
    bestPages: [{ url: String, score: Number }],
    worstPages: [{ url: String, score: Number }],
    contentStats: { avgWordCount: Number, totalWords: Number, pagesBelow300: Number },
    recommendations: [String],
  },
  generatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Report', reportSchema);
