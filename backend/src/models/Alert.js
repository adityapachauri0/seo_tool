const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  type: { type: String, enum: ['score_drop', 'new_issue', 'crawl_complete', 'rank_change', 'competitor_change'], required: true },
  severity: { type: String, enum: ['critical', 'warning', 'info'], default: 'info' },
  title: String,
  message: String,
  data: mongoose.Schema.Types.Mixed,
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

alertSchema.index({ projectId: 1, read: 1 });

module.exports = mongoose.model('Alert', alertSchema);
