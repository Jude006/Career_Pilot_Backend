const Application = require('../models/Application');
const Job = require('../models/Job');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get all applications for tracker
// @route   GET /api/tracker
// @access  Private
exports.getApplications = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  
  // Get applications with populated job data
  const applications = await Application.find({ user: userId })
    .populate('job', 'title company location salary type experience')
    .sort('-updatedAt');

  // Organize applications by status
  const applicationsByStatus = {
    saved: applications.filter(app => app.status === 'saved'),
    applied: applications.filter(app => app.status === 'applied'),
    interviewing: applications.filter(app => app.status === 'interviewing'),
    offer: applications.filter(app => app.status === 'offer'),
    rejected: applications.filter(app => app.status === 'rejected')
  };

  res.status(200).json({
    success: true,
    data: applicationsByStatus
  });
});

// @desc    Update application status
// @route   PUT /api/tracker/:id
// @access  Private
exports.updateApplicationStatus = asyncHandler(async (req, res, next) => {
  const { status } = req.body;
  const userId = req.user.id;

  // Validate status
  const validStatuses = ['saved', 'applied', 'interviewing', 'offer', 'rejected'];
  if (!validStatuses.includes(status)) {
    return next(new ErrorResponse('Invalid status', 400));
  }

  // Find application
  const application = await Application.findById(req.params.id);
  
  if (!application) {
    return next(new ErrorResponse('Application not found', 404));
  }

  // Check ownership
  if (application.user.toString() !== userId) {
    return next(new ErrorResponse('Not authorized to update this application', 403));
  }

  // Update status and timestamps
  const updateData = { status, updatedAt: Date.now() };
  
  // Set appliedDate if status is changing to 'applied'
  if (status === 'applied' && application.status !== 'applied') {
    updateData.appliedDate = Date.now();
  }
  
  // Set responseDate if status is changing to offer or rejected
  if ((status === 'offer' || status === 'rejected') && 
      application.status !== 'offer' && application.status !== 'rejected') {
    updateData.responseDate = Date.now();
  }

  const updatedApplication = await Application.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true, runValidators: true }
  ).populate('job', 'title company location salary type experience');

  res.status(200).json({
    success: true,
    data: updatedApplication
  });
});

// @desc    Create new application
// @route   POST /api/tracker
// @access  Private
exports.createApplication = asyncHandler(async (req, res, next) => {
  const { jobId, status = 'saved' } = req.body;
  const userId = req.user.id;

  if (!jobId) {
    return next(new ErrorResponse('Please provide a job ID', 400));
  }

  // Check if job exists
  const job = await Job.findById(jobId);
  if (!job) {
    return next(new ErrorResponse('Job not found', 404));
  }

  // Check if application already exists for this job
  const existingApplication = await Application.findOne({
    user: userId,
    job: jobId
  });

  if (existingApplication) {
    return next(new ErrorResponse('Application for this job already exists', 400));
  }

  // Create application
  const application = await Application.create({
    user: userId,
    job: jobId,
    status
  });

  // Populate job data
  await application.populate('job', 'title company location salary type experience');

  res.status(201).json({
    success: true,
    data: application
  });
});

// @desc    Delete application
// @route   DELETE /api/tracker/:id
// @access  Private
exports.deleteApplication = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;

  const application = await Application.findById(req.params.id);

  if (!application) {
    return next(new ErrorResponse('Application not found', 404));
  }

  if (application.user.toString() !== userId) {
    return next(new ErrorResponse('Not authorized to delete this application', 403));
  }

  await application.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});