const mongoose = require('mongoose');

const keywordClusterSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  name: { type: String, required: true },
  intent: { type: String, enum: ['informational', 'commercial', 'transactional', 'navigational'] },
  keywords: [String],
  totalVolume: Number,
  avgDifficulty: Number,
  mappedUrl: String,
  status: { type: String, enum: ['unmapped', 'mapped', 'content_exists', 'gap'], default: 'unmapped' },
}, { timestamps: true });

module.exports = mongoose.model('KeywordCluster', keywordClusterSchema);
