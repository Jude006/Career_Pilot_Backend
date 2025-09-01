const Job = require('../models/Job');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    Create a new job
// @route   POST /api/jobs
// @access  Private
exports.createJob = asyncHandler(async (req, res, next) => {
  const { title, company, location, salary, type, experience, description, skills } = req.body;

  if (!title || !company || !location || !type || !experience || !description) {
    return next(new ErrorResponse('Please provide all required fields', 400));
  }

  // Handle skills input - it could be string or array
  let skillsArray = [];
  if (skills) {
    if (typeof skills === 'string') {
      // If skills is a string, split by commas
      skillsArray = skills.split(',').map(skill => skill.trim()).filter(skill => skill);
    } else if (Array.isArray(skills)) {
      // If skills is already an array, use it directly
      skillsArray = skills.map(skill => typeof skill === 'string' ? skill.trim() : skill).filter(skill => skill);
    }
  }

  const job = await Job.create({
    title,
    company,
    location,
    salary,
    type,
    experience,
    description,
    skills: skillsArray,
    postedBy: req.user.id,
    logo: company.charAt(0).toUpperCase()
  });

  res.status(201).json({
    success: true,
    data: job
  });
});

// @desc    Get all jobs
// @route   GET /api/jobs
// @access  Public
exports.getJobs = asyncHandler(async (req, res, next) => {
  const { search, jobType, location, salary, experience } = req.query;

  let query = {};

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { company: { $regex: search, $options: 'i' } },
      { skills: { $regex: search, $options: 'i' } }
    ];
  }

  if (jobType) query.type = jobType;
  if (location) query.location = { $regex: location, $options: 'i' };
  if (experience) query.experience = experience;
  if (salary) {
    const [min, max] = salary.split('-').map(s => parseInt(s.replace(/[^0-9]/g, '')) * 1000);
    query.salary = { $gte: min, $lte: max };
  }

  const jobs = await Job.find(query)
    .populate('postedBy', 'name')
    .sort('-createdAt');

  res.status(200).json({
    success: true,
    count: jobs.length,
    data: jobs
  });
});

// @desc    Get single job
// @route   GET /api/jobs/:id
// @access  Public
exports.getJob = asyncHandler(async (req, res, next) => {
  const job = await Job.findById(req.params.id).populate('postedBy', 'name');

  if (!job) {
    return next(new ErrorResponse('Job not found', 404));
  }

  res.status(200).json({
    success: true,
    data: job
  });
});

// @desc    Update job
// @route   PUT /api/jobs/:id
// @access  Private
exports.updateJob = asyncHandler(async (req, res, next) => {
  let job = await Job.findById(req.params.id);

  if (!job) {
    return next(new ErrorResponse('Job not found', 404));
  }

  if (job.postedBy.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to update this job', 403));
  }

  const { title, company, location, salary, type, experience, description, skills } = req.body;

  // Handle skills input - it could be string or array
  let skillsArray = job.skills; // Default to existing skills
  if (skills) {
    if (typeof skills === 'string') {
      // If skills is a string, split by commas
      skillsArray = skills.split(',').map(skill => skill.trim()).filter(skill => skill);
    } else if (Array.isArray(skills)) {
      // If skills is already an array, use it directly
      skillsArray = skills.map(skill => typeof skill === 'string' ? skill.trim() : skill).filter(skill => skill);
    }
  }

  job = await Job.findByIdAndUpdate(
    req.params.id,
    {
      title,
      company,
      location,
      salary,
      type,
      experience,
      description,
      skills: skillsArray,
      logo: company ? company.charAt(0).toUpperCase() : job.logo
    },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    data: job
  });
}); 
// @desc    Delete job
// @route   DELETE /api/jobs/:id
// @access  Private
exports.deleteJob = asyncHandler(async (req, res, next) => {
  const job = await Job.findById(req.params.id);

  if (!job) {
    return next(new ErrorResponse('Job not found', 404));
  }

  if (job.postedBy.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to delete this job', 403));
  }

  await job.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Toggle save job
// @route   PUT /api/jobs/:id/save
// @access  Private
exports.toggleSaveJob = asyncHandler(async (req, res, next) => {
  const job = await Job.findById(req.params.id);

  if (!job) {
    return next(new ErrorResponse('Job not found', 404));
  }

  const userId = req.user.id;
  const isSaved = job.isSaved.includes(userId);

  if (isSaved) {
    job.isSaved = job.isSaved.filter(id => id.toString() !== userId);
  } else {
    job.isSaved.push(userId);
  }

  await job.save();

  res.status(200).json({
    success: true,
    data: job
  });
});