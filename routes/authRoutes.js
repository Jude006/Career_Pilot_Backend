const express = require('express');
const {
  register,
  login,
  getMe,
  updateDetails,
  updatePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  uploadAvatar // Add this import
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../config/multer'); // You'll need to create this

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/updatedetails', protect, updateDetails);
router.put('/updatepassword', protect, updatePassword);
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword', resetPassword);
router.get('/verifyemail', verifyEmail);
router.post('/resendverification', protect, resendVerification);
router.post('/uploadavatar', protect, upload.single('file'), uploadAvatar); // Add this route

module.exports = router;