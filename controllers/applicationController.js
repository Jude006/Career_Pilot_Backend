const Application = require('../models/Application');
const Job = require('../models/Job');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    Create a new application
// @route   POST /api/applications
// @access  Private
exports.createApplication = asyncHandler(async (req, res, next) => {
  const { jobId, status } = req.body;

  if (!jobId) {
    return next(new ErrorResponse('Please provide a job ID', 400));
  }

  const job = await Job.findById(jobId);
  if (!job) {
    return next(new ErrorResponse('Job not found', 404));
  }

  const application = await Application.create({
    user: req.user.id,
    job: jobId,
    status
  });

  res.status(201).json({
    success: true,
    data: application
  });
});

// @desc    Get all applications for user
// @route   GET /api/applications
// @access  Private
exports.getApplications = asyncHandler(async (req, res, next) => {
  const applications = await Application.find({ user: req.user.id })
    .populate('job', 'title company location');

  res.status(200).json({
    success: true,
    count: applications.length,
    data: applications
  });
});

// @desc    Update application status
// @route   PUT /api/applications/:id
// @access  Private
exports.updateApplication = asyncHandler(async (req, res, next) => {
  const { status } = req.body;

  let application = await Application.findById(req.params.id);

  if (!application) {
    return next(new ErrorResponse('Application not found', 404));
  }

  if (application.user.toString() !== req.user.id) {
    return next(new ErrorResponse('Not authorized to update this application', 403));
  }

  application = await Application.findByIdAndUpdate(
    req.params.id,
    { status, updatedAt: Date.now() },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    data: application
  });
});

// @desc    Delete application
// @route   DELETE /api/applications/:id
// @access  Private
exports.deleteApplication = asyncHandler(async (req, res, next) => {
  const application = await Application.findById(req.params.id);

  if (!application) {
    return next(new ErrorResponse('Application not found', 404));
  }

  if (application.user.toString() !== req.user.id) {
    return next(new ErrorResponse('Not authorized to delete this application', 403));
  }

  await application.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});