const express = require('express');
const {
  getDashboardStats,
  getRecentActivity,
  getAnalytics,
  getTopLocations,
  getSystemHealth
} = require('../controllers/dashboardController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

// @route   GET /api/dashboard/stats
// @desc    Get dashboard statistics
// @access  Private
router.get('/stats', authenticateToken, getDashboardStats);

// @route   GET /api/dashboard/activity
// @desc    Get recent activity
// @access  Private
router.get('/activity', authenticateToken, getRecentActivity);

// @route   GET /api/dashboard/analytics
// @desc    Get analytics data (Admin only)
// @access  Private/Admin
router.get('/analytics', authenticateToken, authorizeRoles('ADMIN'), getAnalytics);

// @route   GET /api/dashboard/locations
// @desc    Get top locations (Admin only)
// @access  Private/Admin
router.get('/locations', authenticateToken, authorizeRoles('ADMIN'), getTopLocations);

// @route   GET /api/dashboard/health
// @desc    Get system health metrics (Admin only)
// @access  Private/Admin
router.get('/health', authenticateToken, authorizeRoles('ADMIN'), getSystemHealth);

module.exports = router;
