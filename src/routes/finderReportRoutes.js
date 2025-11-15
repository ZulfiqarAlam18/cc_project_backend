const express = require('express');
const {
  createFinderReport,
  getFinderReports,
  getFinderReportById,
  updateFinderReport,
  deleteFinderReport,
  getMyFinderReports
} = require('../controllers/finderReportController');
const { authenticateToken, authorizeRoles, checkResourceOwnership } = require('../middleware/authMiddleware');
const { uploadMultiple } = require('../middleware/uploadMiddleware');
const {
  finderReportValidation
} = require('../middleware/validateMiddleware');

const router = express.Router();

// @route   POST /api/finder-reports
// @desc    Create finder report
// @access  Private
router.post(
  '/',
  authenticateToken,
  uploadMultiple('images', 5), // Max 5 images
  finderReportValidation,
  createFinderReport
);

// @route   GET /api/finder-reports
// @desc    Get all finder reports with filtering
// @access  Private
router.get('/', authenticateToken, getFinderReports);

// @route   GET /api/finder-reports/my
// @desc    Get current user's finder reports
// @access  Private
router.get('/my', authenticateToken, getMyFinderReports);

// @route   GET /api/finder-reports/:reportId
// @desc    Get finder report by ID
// @access  Private
router.get('/:reportId', authenticateToken, getFinderReportById);

// @route   PUT /api/finder-reports/:reportId
// @desc    Update finder report
// @access  Private (Owner or Admin)
router.put(
  '/:reportId',
  authenticateToken,
  updateFinderReport
);

// @route   DELETE /api/finder-reports/:reportId
// @desc    Delete finder report
// @access  Private (Owner or Admin)
router.delete('/:reportId', authenticateToken, deleteFinderReport);

module.exports = router;
