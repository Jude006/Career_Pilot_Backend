const mongoose = require('mongoose');

const AIInsightSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['resume_analysis', 'job_match', 'interview_prep', 'skill_gap', 'career_path'],
    required: true
  },
  insights: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  score: {
    type: Number,
    min: 0,
    max: 100
  },
  recommendations: [String],
  generatedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 1 week
  }
});

module.exports = mongoose.model('AIInsight', AIInsightSchema);