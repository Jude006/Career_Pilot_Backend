const express = require('express');
const {
  getApplications,
  updateApplicationStatus,
  createApplication,
  deleteApplication
} = require('../controllers/trackerController');
const { protect } = require('../middleware/authMiddleware');
 
const router = express.Router();

router.route('/')
  .get(protect, getApplications)
  .post(protect, createApplication);

router.route('/:id')
  .put(protect, updateApplicationStatus)
  .delete(protect, deleteApplication);

module.exports = router;