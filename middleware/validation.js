const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

exports.validateForgotPassword = (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'Email is required'
    });
  }

  if (typeof email !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Email must be a valid string'
    });
  }

  if (!validateEmail(email.trim())) {
    return res.status(400).json({
      success: false,
      error: 'Please provide a valid email address'
    });
  }

  next();
};