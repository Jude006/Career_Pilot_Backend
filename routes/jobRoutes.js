const express = require('express');
const {
  createJob,
  getJobs,
  getJob,
  updateJob,
  deleteJob,
  toggleSaveJob
} = require('../controllers/jobController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/')
  .post(protect, createJob)
  .get(getJobs);

router.route('/:id')
  .get(getJob)
  .put(protect, updateJob)
  .delete(protect, deleteJob);

router.route('/:id/save')
  .put(protect, toggleSaveJob);

module.exports = router;