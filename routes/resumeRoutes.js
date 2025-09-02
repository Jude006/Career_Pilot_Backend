const express = require('express');
const {
  uploadResume,
  getResume,
  deleteResume
} = require('../controllers/resumeController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../config/multer');

const router = express.Router();

router.use(protect);

router.post('/upload', upload.single('resume'), uploadResume);
router.get('/', getResume);
router.delete('/', deleteResume);

module.exports = router;