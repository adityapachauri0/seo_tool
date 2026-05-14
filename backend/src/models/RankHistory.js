const mongoose = require('mongoose');

const rankHistorySchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  keyword: { type: String, required: true },
  position: Number,
  url: String,
  clicks: Number,
  impressions: Number,
  ctr: Number,
  date: { type: Date, required: true },
}, { timestamps: true });

rankHistorySchema.index({ projectId: 1, keyword: 1, date: 1 });

module.exports = mongoose.model('RankHistory', rankHistorySchema);
