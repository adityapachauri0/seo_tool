const mongoose = require('mongoose');

const auditSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true,
  },
  url: {
    type: String,
    required: true,
  },
  score: Number,
  issues: { type: mongoose.Schema.Types.Mixed, default: [] },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  headings: { type: mongoose.Schema.Types.Mixed, default: {} },
  links: { type: mongoose.Schema.Types.Mixed, default: {} },
  images: { type: mongoose.Schema.Types.Mixed, default: [] },
  schema: { type: mongoose.Schema.Types.Mixed, default: null },
  performance: { type: mongoose.Schema.Types.Mixed, default: {} },
  content: { type: mongoose.Schema.Types.Mixed, default: {} },
  crawledAt: {
    type: Date,
    default: Date.now,
  },
}, { strict: false });

module.exports = mongoose.model('Audit', auditSchema);
