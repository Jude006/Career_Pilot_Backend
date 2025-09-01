const express = require('express');
const {
  createApplication,
  getApplications,
  updateApplication,
  deleteApplication
} = require('../controllers/applicationController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes are protected
router.use(protect);

router.route('/')
  .post(createApplication)
  .get(getApplications);

router.route('/:id')
  .put(updateApplication)
  .delete(deleteApplication);

module.exports = router;