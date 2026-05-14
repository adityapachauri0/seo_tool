const mongoose = require('mongoose');

const keywordSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  keyword: { type: String, required: true },
  volume: Number,
  cpc: Number,
  competition: { type: String, enum: ['low', 'medium', 'high'] },
  competitionIndex: Number, // 0-100
  trend: [{ month: String, volume: Number }], // 12 months
  intent: { type: String, enum: ['informational', 'commercial', 'transactional', 'navigational'] },
  difficulty: Number, // 0-100
  currentRank: Number,
  previousRank: Number,
  rankChange: Number, // positive = improved
  rankHistory: [{ date: Date, position: Number }],
  clusterId: String,
  clusterName: String,
  cluster: String, // topic cluster name (alias)
  url: String, // ranking URL
  impressions: Number,
  clicks: Number,
  ctr: Number,
  avgPosition: Number,
  opportunityScore: Number, // computed score
  tags: [String],
  source: { type: String, enum: ['manual', 'google_ads', 'search_console', 'suggested'], default: 'manual' },
  lastUpdated: { type: Date, default: Date.now },
}, { timestamps: true });

keywordSchema.index({ projectId: 1, keyword: 1 }, { unique: true });

module.exports = mongoose.model('Keyword', keywordSchema);
