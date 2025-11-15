const express = require('express');
const {
  getFullProfile,
  getProfileStats,
  getParentReports,
  getFinderReports,
  getMatches,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead
} = require('../controllers/profileController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// @route   GET /api/profile
// @desc    Get full user profile with related data
// @access  Private
router.get('/', authenticateToken, getFullProfile);

// @route   GET /api/profile/stats
// @desc    Get user profile statistics
// @access  Private
router.get('/stats', authenticateToken, getProfileStats);

// @route   GET /api/profile/parent-reports
// @desc    Get user's parent reports
// @access  Private
router.get('/parent-reports', authenticateToken, getParentReports);

// @route   GET /api/profile/finder-reports
// @desc    Get user's finder reports
// @access  Private
router.get('/finder-reports', authenticateToken, getFinderReports);

// @route   GET /api/profile/matches
// @desc    Get user's matches
// @access  Private
router.get('/matches', authenticateToken, getMatches);

// @route   GET /api/profile/notifications
// @desc    Get user's notifications
// @access  Private
router.get('/notifications', authenticateToken, getNotifications);

// @route   PUT /api/profile/notifications/:notificationId/read
// @desc    Mark notification as read
// @access  Private
router.put('/notifications/:notificationId/read', authenticateToken, markNotificationRead);

// @route   PUT /api/profile/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.put('/notifications/read-all', authenticateToken, markAllNotificationsRead);

module.exports = router;
