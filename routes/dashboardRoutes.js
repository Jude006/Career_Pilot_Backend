const express = require('express');
const {
  getDashboardData,
  getQuickStats
} = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/')
  .get(protect, getDashboardData);

router.route('/quick-stats')
  .get(protect, getQuickStats);

module.exports = router;