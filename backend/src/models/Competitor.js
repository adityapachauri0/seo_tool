const mongoose = require('mongoose');

const competitorSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    domain: {
      type: String,
      required: [true, 'Competitor domain is required'],
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      trim: true,
    },
    lastAuditScore: Number,
    lastAuditAt: Date,
    commonKeywords: {
      type: Number,
      default: 0,
    },
    keywordGaps: {
      type: Number,
      default: 0,
    },
    backlinks: {
      type: Number,
      default: 0,
    },
    techStack: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    pages: [
      {
        url: String,
        title: String,
        score: Number,
        crawledAt: Date,
      },
    ],
    alerts: [
      {
        type: { type: String },
        message: String,
        date: Date,
      },
    ],
    status: {
      type: String,
      enum: ['active', 'paused'],
      default: 'active',
    },
  },
  { timestamps: true }
);

competitorSchema.index({ projectId: 1, domain: 1 }, { unique: true });

module.exports = mongoose.model('Competitor', competitorSchema);
