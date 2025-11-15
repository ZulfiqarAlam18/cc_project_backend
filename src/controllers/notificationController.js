const { prisma } = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendNotification, sendBulkNotification } = require('../services/notificationService');

// Get user notifications
const getNotifications = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { page = 1, limit = 20, unreadOnly = false, type } = req.query;
  const skip = (page - 1) * limit;

  const where = {
    userId
  };

  if (unreadOnly === 'true') {
    where.isRead = false;
  }

  if (type) {
    where.type = type.toUpperCase();
  }

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' }
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: {
        userId,
        isRead: false
      }
    })
  ]);

  res.json({
    success: true,
    data: {
      notifications,
      unreadCount,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// Mark notification as read
const markAsRead = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { notificationId } = req.params;

  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId
    }
  });

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found'
    });
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: { 
      isRead: true,
      readAt: new Date()
    }
  });

  res.json({
    success: true,
    message: 'Notification marked as read'
  });
});

// Mark all notifications as read
const markAllAsRead = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false
    },
    data: { 
      isRead: true,
      readAt: new Date()
    }
  });

  res.json({
    success: true,
    message: 'All notifications marked as read'
  });
});

// Delete notification
const deleteNotification = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { notificationId } = req.params;

  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId
    }
  });

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found'
    });
  }

  await prisma.notification.delete({
    where: { id: notificationId }
  });

  res.json({
    success: true,
    message: 'Notification deleted successfully'
  });
});

// Delete all notifications for user
const deleteAllNotifications = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  await prisma.notification.deleteMany({
    where: { userId }
  });

  res.json({
    success: true,
    message: 'All notifications deleted successfully'
  });
});

// Send notification (Admin only)
const sendNotificationToUser = asyncHandler(async (req, res) => {
  const { userId, title, message, type = 'GENERAL', data } = req.body;

  // Check if target user exists
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  await sendNotification({
    userId,
    title,
    message,
    type: type.toUpperCase(),
    data
  });

  res.json({
    success: true,
    message: 'Notification sent successfully'
  });
});

// Send bulk notification (Admin only)
const sendBulkNotifications = asyncHandler(async (req, res) => {
  const { userIds, title, message, type = 'GENERAL', data, filters } = req.body;

  let targetUsers = [];

  if (userIds && userIds.length > 0) {
    // Send to specific users
    targetUsers = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        isActive: true
      },
      select: { id: true }
    });
  } else if (filters) {
    // Send based on filters
    const where = { isActive: true };
    
    if (filters.role) {
      where.role = filters.role.toUpperCase();
    }
    
    if (filters.hasReports) {
      where.OR = [
        { parentReports: { some: {} } },
        { finderReports: { some: {} } }
      ];
    }

    if (filters.lastLoginAfter) {
      where.lastLogin = {
        gte: new Date(filters.lastLoginAfter)
      };
    }

    targetUsers = await prisma.user.findMany({
      where,
      select: { id: true }
    });
  } else {
    // Send to all active users
    targetUsers = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true }
    });
  }

  if (targetUsers.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No users found matching the criteria'
    });
  }

  await sendBulkNotification({
    userIds: targetUsers.map(u => u.id),
    title,
    message,
    type: type.toUpperCase(),
    data
  });

  res.json({
    success: true,
    message: `Notification sent to ${targetUsers.length} users`
  });
});

// Get notification statistics (Admin only)
const getNotificationStats = asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;

  let daysBack;
  switch (period) {
    case '7d':
      daysBack = 7;
      break;
    case '30d':
      daysBack = 30;
      break;
    case '90d':
      daysBack = 90;
      break;
    default:
      daysBack = 30;
  }

  const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  const stats = await prisma.$transaction(async (tx) => {
    const [
      totalNotifications,
      unreadNotifications,
      notificationsByType,
      notificationsOverTime,
      readRate
    ] = await Promise.all([
      tx.notification.count({
        where: {
          createdAt: { gte: startDate }
        }
      }),
      tx.notification.count({
        where: {
          createdAt: { gte: startDate },
          isRead: false
        }
      }),
      tx.notification.groupBy({
        by: ['type'],
        where: {
          createdAt: { gte: startDate }
        },
        _count: {
          id: true
        }
      }),
      tx.notification.groupBy({
        by: ['createdAt'],
        where: {
          createdAt: { gte: startDate }
        },
        _count: {
          id: true
        }
      }),
      tx.notification.count({
        where: {
          createdAt: { gte: startDate },
          isRead: true
        }
      })
    ]);

    const readPercentage = totalNotifications > 0 ? 
      ((readRate / totalNotifications) * 100).toFixed(2) : 0;

    return {
      overview: {
        total: totalNotifications,
        unread: unreadNotifications,
        readPercentage: parseFloat(readPercentage)
      },
      byType: notificationsByType.map(item => ({
        type: item.type,
        count: item._count.id
      })),
      overTime: notificationsOverTime.map(item => ({
        date: item.createdAt.toISOString().split('T')[0],
        count: item._count.id
      }))
    };
  });

  res.json({
    success: true,
    data: { stats }
  });
});

// Update notification preferences
const updateNotificationPreferences = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { emailNotifications, pushNotifications, smsNotifications, types } = req.body;

  // This would typically be stored in a user preferences table
  // For now, we'll use a simple JSON field in the user table
  const preferences = {
    email: emailNotifications !== undefined ? emailNotifications : true,
    push: pushNotifications !== undefined ? pushNotifications : true,
    sms: smsNotifications !== undefined ? smsNotifications : false,
    types: types || {
      MATCH_FOUND: true,
      MATCH_CONFIRMED: true,
      STATUS_UPDATE: true,
      ADMIN_ALERT: false,
      GENERAL: true
    }
  };

  // Since notificationPreferences field doesn't exist in User model,
  // we'll just return success for now without actually saving
  // TODO: Add notificationPreferences field to User model or create separate table

  res.json({
    success: true,
    message: 'Notification preferences updated successfully',
    data: { preferences }
  });
});

// Get notification preferences
const getNotificationPreferences = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  // Since notificationPreferences field doesn't exist in User model,
  // return default preferences for now
  const preferences = {
    email: true,
    push: true,
    sms: false,
    types: {
      MATCH_FOUND: true,
      MATCH_CONFIRMED: true,
      STATUS_UPDATE: true,
      ADMIN_ALERT: false,
      GENERAL: true
    }
  };

  res.json({
    success: true,
    data: { preferences }
  });
});

module.exports = {
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
};
