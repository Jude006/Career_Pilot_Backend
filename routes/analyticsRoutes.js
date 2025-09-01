const express = require('express');
const {
  getAnalytics,
  exportAnalytics,
  downloadExport
} = require('../controllers/analyticsController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/')
  .get(protect, getAnalytics);

router.route('/export')
  .post(protect, exportAnalytics);

router.route('/download/:id')
  .get(protect, downloadExport);

module.exports = router;