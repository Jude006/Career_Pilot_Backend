const express = require('express');
const {
  exportData,
  getExportHistory
} = require('../controllers/exportController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/')
  .post(protect, exportData);

router.route('/history')
  .get(protect, getExportHistory);

module.exports = router;