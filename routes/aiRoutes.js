const express = require('express');
const {
  analyzeResume,
  getJobMatches,
  prepareForInterview,
  analyzeSkillGaps,
  getAIDashboard
} = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.post('/analyze-resume', analyzeResume);
router.get('/job-matches', getJobMatches);
router.post('/interview-prep', prepareForInterview);
router.get('/skill-gaps', analyzeSkillGaps);
router.get('/dashboard', getAIDashboard);

module.exports = router;