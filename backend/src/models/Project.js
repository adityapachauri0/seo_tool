const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
    },
    domain: {
      type: String,
      required: [true, 'Domain is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    protocol: {
      type: String,
      default: 'https',
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'archived'],
      default: 'active',
    },
    tags: {
      type: [String],
      default: [],
    },
    crawlFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'manual'],
      default: 'manual',
    },
    lastCrawlAt: {
      type: Date,
    },
    lastScore: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Project', projectSchema);
