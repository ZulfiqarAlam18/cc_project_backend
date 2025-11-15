const express = require('express');
const {
  createParentReport,
  getParentReports,
  getParentReportById,
  updateParentReport,
  deleteParentReport,
  getMyParentReports
} = require('../controllers/parentReportController');
const { authenticateToken, authorizeRoles, checkResourceOwnership } = require('../middleware/authMiddleware');
const { uploadMultiple } = require('../middleware/uploadMiddleware');
const {
  parentReportValidation
} = require('../middleware/validateMiddleware');

const router = express.Router();

// @route   POST /api/parent-reports
// @desc    Create parent report
// @access  Private
router.post(
  '/',
  authenticateToken,
  uploadMultiple('images', 5), // Max 5 images
  parentReportValidation,
  createParentReport
);

// @route   GET /api/parent-reports
// @desc    Get all parent reports with filtering
// @access  Private
router.get('/', authenticateToken, getParentReports);

// @route   GET /api/parent-reports/my
// @desc    Get current user's parent reports
// @access  Private
router.get('/my', authenticateToken, getMyParentReports);

// @route   GET /api/parent-reports/:reportId
// @desc    Get parent report by ID
// @access  Private
router.get('/:reportId', authenticateToken, getParentReportById);

// @route   PUT /api/parent-reports/:reportId
// @desc    Update parent report
// @access  Private (Owner or Admin)
router.put(
  '/:reportId',
  authenticateToken,
  
  updateParentReport
);

// @route   DELETE /api/parent-reports/:reportId
// @desc    Delete parent report
// @access  Private (Owner or Admin)
router.delete('/:reportId', authenticateToken, deleteParentReport);

module.exports = router;
