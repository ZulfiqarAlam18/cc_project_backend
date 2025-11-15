const express = require('express');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  sendNotificationToUser,
  sendBulkNotifications,
  getNotificationStats,
  updateNotificationPreferences,
  getNotificationPreferences
} = require('../controllers/notificationController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

// @route   GET /api/notifications
// @desc    Get user notifications
// @access  Private
router.get('/', authenticateToken, getNotifications);

// @route   PUT /api/notifications/:notificationId/read
// @desc    Mark notification as read
// @access  Private
router.put('/:notificationId/read', authenticateToken, markAsRead);

// @route   PUT /api/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.put('/read-all', authenticateToken, markAllAsRead);

// @route   DELETE /api/notifications/:notificationId
// @desc    Delete notification
// @access  Private
router.delete('/:notificationId', authenticateToken, deleteNotification);

// @route   DELETE /api/notifications
// @desc    Delete all notifications
// @access  Private
router.delete('/', authenticateToken, deleteAllNotifications);

// @route   GET /api/notifications/preferences
// @desc    Get notification preferences
// @access  Private
router.get('/preferences', authenticateToken, getNotificationPreferences);

// @route   PUT /api/notifications/preferences
// @desc    Update notification preferences
// @access  Private
router.put(
  '/preferences',
  authenticateToken,
  updateNotificationPreferences
);

// Admin routes
// @route   POST /api/notifications/send
// @desc    Send notification to user (Admin only)
// @access  Private/Admin
router.post(
  '/send',
  authenticateToken,
  authorizeRoles('ADMIN'),
  sendNotificationToUser
);

// @route   POST /api/notifications/bulk
// @desc    Send bulk notifications (Admin only)
// @access  Private/Admin
router.post(
  '/bulk',
  authenticateToken,
  authorizeRoles('ADMIN'),
  sendBulkNotifications
);

// @route   GET /api/notifications/stats
// @desc    Get notification statistics (Admin only)
// @access  Private/Admin
router.get('/stats', authenticateToken, authorizeRoles('ADMIN'), getNotificationStats);

module.exports = router;
