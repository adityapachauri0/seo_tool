const mongoose = require('mongoose');

const linkOpportunitySchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  type: { type: String, enum: ['unlinked_mention', 'press_target'], required: true },
  url: { type: String, required: true },
  title: String,
  snippet: String,
  query: String, // the search that surfaced it
  status: { type: String, enum: ['new', 'contacted', 'done', 'ignored'], default: 'new' },
  foundAt: { type: Date, default: Date.now },
}, { timestamps: true });

linkOpportunitySchema.index({ projectId: 1, url: 1 }, { unique: true });
linkOpportunitySchema.index({ projectId: 1, status: 1 });

module.exports = mongoose.model('LinkOpportunity', linkOpportunitySchema);
