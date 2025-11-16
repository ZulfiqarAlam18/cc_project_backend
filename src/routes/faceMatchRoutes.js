const express = require('express');
const router = express.Router();
const {
  checkFaceMatchService,
  compareTwoImages,
  findMatchesForParentReport,
  findMatchesForFinderReport,
  compareSpecificReports
} = require('../controllers/faceMatchController');
const { authenticate } = require('../middleware/authMiddleware');

// Health check for face matching service
router.get('/health', checkFaceMatchService);

// Compare two images directly (requires authentication)
router.post('/compare-images', authenticate, compareTwoImages);

// Find matches for a specific parent report
router.post('/parent/:parentReportId/find-matches', authenticate, findMatchesForParentReport);

// Find matches for a specific finder report
router.post('/finder/:finderReportId/find-matches', authenticate, findMatchesForFinderReport);

// Compare specific parent and finder reports
router.post('/compare-reports', authenticate, compareSpecificReports);

module.exports = router;
