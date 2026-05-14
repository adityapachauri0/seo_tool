const mongoose = require('mongoose');

const contentBriefSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  targetKeyword: { type: String, required: true },
  title: String,
  outline: [{ heading: String, level: Number, notes: String }],
  requiredTopics: [String],
  suggestedWordCount: Number,
  targetIntent: String,
  competitorInsights: [{ url: String, title: String, wordCount: Number, headings: [String] }],
  metaSuggestions: {
    titles: [String],
    descriptions: [String],
  },
  status: { type: String, enum: ['draft', 'in_progress', 'published'], default: 'draft' },
  assignedUrl: String,
}, { timestamps: true });

module.exports = mongoose.model('ContentBrief', contentBriefSchema);
