const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/User');
const sendEmail = require('../config/email');
const crypto = require('crypto');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

// Generate 6-digit code
const generateResetCode = () => Math.floor(100000 + Math.random() * 900000);

// Helper function to send token response
const sendTokenResponse = (user, statusCode, res) => {
  const token = user.getSignedJwtToken();

  const options = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    ),
    httpOnly: true
  };

  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
    options.sameSite = 'none';
  }

  res
  .status(statusCode)
  .cookie('token', token, options)
  .json({
    success: true,
    token,
    user: {
      id: user._id, // Make sure this is included
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      emailVerified: user.emailVerified
    }
  });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return next(new ErrorResponse('Please provide name, email and password', 400));
    }

    if (password.length < 6) {
      return next(new ErrorResponse('Password must be at least 6 characters', 400));
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return next(new ErrorResponse('User already exists with this email', 400));
    }

    // Create user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: 'user'
    });

    // Generate email verification token
    const verifyToken = user.getEmailVerifyToken();
    await user.save({ validateBeforeSave: false });

    // Create verification URL
    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verifyToken}`;

    // Email message
    const message = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">Welcome to CareerPilot! 🚀</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #333; margin-bottom: 20px;">Almost there!</h2>
          <p style="color: #666; line-height: 1.6;">Please verify your email address to complete your registration and start managing your job search.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Verify Email Address
            </a>
          </div>
          <p style="color: #999; font-size: 14px; text-align: center;">
            This link will expire in 24 hours.<br>
            If the button doesn't work, copy and paste this link in your browser:<br>
            <a href="${verifyUrl}" style="color: #667eea;">${verifyUrl}</a>
          </p>
        </div>
        <div style="background: #f1f1f1; padding: 20px; text-align: center; color: #666; font-size: 12px;">
          <p>If you didn't create an account with CareerPilot, please ignore this email.</p>
        </div>
      </div>
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Verify Your Email - CareerPilot',
        message
      });

      sendTokenResponse(user, 201, res);
    } catch (emailErr) {
      console.error('Email send error:', emailErr);
      user.emailVerifyToken = undefined;
      user.emailVerifyExpire = undefined;
      await user.save({ validateBeforeSave: false });
      
      return next(new ErrorResponse('Email could not be sent', 500));
    }
  } catch (err) {
    if (err.code === 11000) {
      return next(new ErrorResponse('User already exists with this email', 400));
    }
    next(err);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      return next(new ErrorResponse('Please provide an email and password', 400));
    }

    // Check for user
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      return next(new ErrorResponse('Invalid credentials', 401));
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return next(new ErrorResponse('Invalid credentials', 401));
    }

    // Update last login
    user.lastLogin = Date.now();
    await user.save({ validateBeforeSave: false });

    sendTokenResponse(user, 200, res);
  } catch (err) {
    next(err);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update user details
// @route   PUT /api/auth/updatedetails
// @access  Private
exports.updateDetails = async (req, res, next) => {
  try {
    const fieldsToUpdate = {
      name: req.body.name,
      email: req.body.email,
      bio: req.body.bio,
      location: req.body.location,
      jobTitle: req.body.jobTitle,
      skills: req.body.skills,
      phone: req.body.phone,
      education: req.body.education,
      website: req.body.website
    };

    // Remove undefined fields
    Object.keys(fieldsToUpdate).forEach(key => {
      if (fieldsToUpdate[key] === undefined) {
        delete fieldsToUpdate[key];
      }
    });

    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
exports.updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return next(new ErrorResponse('Please provide current and new password', 400));
    }

    if (newPassword.length < 6) {
      return next(new ErrorResponse('New password must be at least 6 characters', 400));
    }

    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    if (!(await user.comparePassword(currentPassword))) {
      return next(new ErrorResponse('Current password is incorrect', 401));
    }

    user.password = newPassword;
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (err) {
    next(err);
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgotpassword
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Add proper validation and error handling
    if (!email) {
      return next(new ErrorResponse('Please provide an email', 400));
    }

    // Ensure email is a string before calling toLowerCase()
    if (typeof email !== 'string') {
      return next(new ErrorResponse('Email must be a valid string', 400));
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      // Don't reveal if email exists or not for security
      return res.status(200).json({
        success: true,
        message: 'If this email exists, a reset code has been sent'
      });
    }

    // Generate reset code
    const resetCode = generateResetCode();
    
    // Hash and save the code
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetCode.toString())
      .digest('hex');
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
    
    await user.save({ validateBeforeSave: false });

    // Send email
    const message = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">Password Reset 🔒</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: '); // Fix the template string
          <h2 style="color: #333; margin-bottom: 20px;">Hello ${user.name},</h2>
          <p style="color: #666; line-height: 1.6;">You requested to reset your password. Use the code below to reset it:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <div style="background: #667eea; color: white; padding: 20px; border-radius: 10px; display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 5px;">
              ${resetCode}
            </div>
          </div>
          
          <p style="color: #999; font-size: 14px; text-align: center;">
            This code will expire in 10 minutes.<br>
            If you didn't request this, please ignore this email and your password will remain unchanged.
          </p>
        </div>
        <div style="background: #f1f1f1; padding: 20px; text-align: center; color: #666; font-size: 12px;">
          <p>CareerPilot Security Team</p>
        </div>
      </div>
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Password Reset Code - CareerPilot',
        message
      });

      res.status(200).json({
        success: true,
        message: 'Reset code sent to email',
        email: user.email
      });
    } catch (emailErr) {
      console.error('Email send error:', emailErr);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });

      return next(new ErrorResponse('Email could not be sent', 500));
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    next(error);
  }
};

// @desc    Reset password
// @route   PUT /api/auth/resetpassword
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, code, password } = req.body;

    if (!email || !code || !password) {
      return next(new ErrorResponse('Please provide email, code and new password', 400));
    }

    if (password.length < 6) {
      return next(new ErrorResponse('Password must be at least 6 characters', 400));
    }

    const cleanEmail = email.toString().trim().toLowerCase();
    const cleanCode = code.toString().trim();
    
    if (cleanCode.length !== 6 || isNaN(cleanCode)) {
      return next(new ErrorResponse('Reset code must be 6 digits', 400));
    }

    const hashedCode = crypto
      .createHash('sha256')
      .update(cleanCode)
      .digest('hex');

    const user = await User.findOne({
      email: cleanEmail,
      resetPasswordToken: hashedCode,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return next(new ErrorResponse('Invalid or expired reset code', 400));
    }

    // Set new password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Send confirmation email
    const message = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">Password Updated ✅</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #333; margin-bottom: 20px;">Hello ${user.name},</h2>
          <p style="color: #666; line-height: 1.6;">Your password has been successfully updated.</p>
          <p style="color: #666; line-height: 1.6;">If you didn't make this change, please contact our support team immediately.</p>
        </div>
        <div style="background: #f1f1f1; padding: 20px; text-align: center; color: #666; font-size: 12px;">
          <p>CareerPilot Security Team</p>
        </div>
      </div>
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Password Updated - CareerPilot',
        message
      });
    } catch (emailErr) {
      console.error('Confirmation email error:', emailErr);
      // Don't fail the reset request if confirmation email fails
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Verify email
// @route   GET /api/auth/verifyemail
// @access  Public
exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.query;

    if (!token) {
      return next(new ErrorResponse('Invalid verification token', 400));
    }

    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      emailVerifyToken: hashedToken,
      emailVerifyExpire: { $gt: Date.now() }
    });

    if (!user) {
      return next(new ErrorResponse('Invalid or expired verification token', 400));
    }

    user.emailVerified = true;
    user.emailVerifyToken = undefined;
    user.emailVerifyExpire = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Resend verification email
// @route   POST /api/auth/resendverification
// @access  Private
exports.resendVerification = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (user.emailVerified) {
      return next(new ErrorResponse('Email already verified', 400));
    }

    const verifyToken = user.getEmailVerifyToken();
    await user.save({ validateBeforeSave: false });

    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verifyToken}`;

    const message = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">Verify Your Email 📧</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #333; margin-bottom: 20px;">Hello ${user.name},</h2>
          <p style="color: #666; line-height: 1.6;">Here's your new verification link:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Verify Email Now
            </a>
          </div>
          <p style="color: #999; font-size: 14px; text-align: center;">
            This link will expire in 24 hours.
          </p>
        </div>
      </div>
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Verify Your Email - CareerPilot',
        message
      });

      res.status(200).json({
        success: true,
        message: 'Verification email sent'
      });
    } catch (emailErr) {
      console.error('Email send error:', emailErr);
      user.emailVerifyToken = undefined;
      user.emailVerifyExpire = undefined;
      await user.save({ validateBeforeSave: false });

      return next(new ErrorResponse('Email could not be sent', 500));
    }
  } catch (error) {
    next(error);
  }
};

exports.uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new ErrorResponse('Please upload a file', 400));
    }

    const user = await User.findById(req.user.id);
    
    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'career-pilot/avatars',
      width: 200,
      height: 200,
      crop: 'limit'
    });

    user.avatar = result.secure_url;
    await user.save();

    res.status(200).json({
      success: true,
      data: {
        avatar: user.avatar
      }
    });
  } catch (err) {
    next(err);
  }
};