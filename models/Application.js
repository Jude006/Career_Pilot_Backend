const mongoose = require('mongoose');

const ApplicationSchema = new mongoose.Schema({
  job: {
    type: mongoose.Schema.ObjectId,
    ref: 'Job',
    required: true
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['saved', 'applied', 'interviewing', 'offer', 'rejected'],
    default: 'saved'
  },
  appliedDate: {
    type: Date
  },
  responseDate: {
    type: Date
  },
  salary: {
    type: Number
  },
  notes: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  interviewDate: {
    type: Date
  },
  interviewTime: {
    type: String
  },
  interviewType: {
    type: String,
    enum: ['Phone', 'Technical', 'Behavioral', 'Culture Fit', 'On-site', 'Other']
  },
  interviewLocation: {
    type: String
  }
});

// Update the updatedAt field before saving
ApplicationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Application', ApplicationSchema);