const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/User');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs').promises;

// @desc    Upload resume
// @route   POST /api/resume/upload
// @access  Private
exports.uploadResume = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  
  if (!req.file) {
    return next(new ErrorResponse('Please upload a resume file', 400));
  }

  const user = await User.findById(userId);
  let textContent = '';

  try {
    // Read file from disk
    const fileBuffer = await fs.readFile(req.file.path);
    
    // Extract text from different file types
    if (req.file.mimetype === 'application/pdf') {
      const pdfData = await pdfParse(fileBuffer);
      textContent = pdfData.text;
    } else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      textContent = result.value;
    } else if (req.file.mimetype === 'text/plain') {
      textContent = fileBuffer.toString('utf8');
    } else {
      // Clean up uploaded file
      await fs.unlink(req.file.path);
      return next(new ErrorResponse('Unsupported file format', 400));
    }
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file.path) {
      await fs.unlink(req.file.path).catch(console.error);
    }
    return next(new ErrorResponse('Failed to process resume file', 500));
  }

  // Clean up previous resume file if exists
  if (user.resume && user.resume.fileUrl) {
    const oldFilePath = path.join(__dirname, '..', user.resume.fileUrl);
    await fs.unlink(oldFilePath).catch(console.error);
  }

  // Update user with resume info
  user.resume = {
    fileUrl: `/uploads/resumes/${req.file.filename}`,
    fileName: req.file.originalname,
    uploadedAt: new Date(),
    textContent: textContent,
    lastAnalyzed: null
  };

  await user.save();

  res.status(200).json({
    success: true,
    data: {
      message: 'Resume uploaded successfully',
      resume: user.resume
    }
  });
});

// @desc    Get user resume
// @route   GET /api/resume
// @access  Private
exports.getResume = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  if (!user.resume || !user.resume.fileUrl) {
    return next(new ErrorResponse('No resume found', 404));
  }

  res.status(200).json({
    success: true,
    data: user.resume
  });
});

// @desc    Delete resume
// @route   DELETE /api/resume
// @access  Private
exports.deleteResume = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  if (!user.resume || !user.resume.fileUrl) {
    return next(new ErrorResponse('No resume found', 404));
  }

  // Delete file from server
  const filePath = path.join(__dirname, '..', user.resume.fileUrl);
  await fs.unlink(filePath).catch(console.error);

  // Remove resume from user
  user.resume = undefined;
  await user.save();

  res.status(200).json({
    success: true,
    data: { message: 'Resume deleted successfully' }
  });
});