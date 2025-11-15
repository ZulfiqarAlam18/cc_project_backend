const { prisma } = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');

// Get user profile with all related data
const getFullProfile = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  // Get basic user data
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      profileImage: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Get counts separately
  const [parentReportsCount, finderReportsCount, notificationsCount] = await Promise.all([
    prisma.parentReport.count({ where: { parentId: userId } }),
    prisma.finderReport.count({ where: { finderId: userId } }),
    prisma.notification.count({ where: { userId: userId } })
  ]);

  // Get recent reports
  const [recentParentReports, recentFinderReports] = await Promise.all([
    prisma.parentReport.findMany({
      where: { parentId: userId },
      select: {
        id: true,
        childName: true,
        status: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    }),
    prisma.finderReport.findMany({
      where: { finderId: userId },
      select: {
        id: true,
        placeFound: true,
        status: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    })
  ]);

  // Combine the data
  const userData = {
    ...user,
    _count: {
      parentReports: parentReportsCount,
      finderReports: finderReportsCount,
      notifications: notificationsCount
    },
    parentReports: recentParentReports,
    finderReports: recentFinderReports
  };

  res.json({
    success: true,
    data: { user: userData }
  });
});

// Get user statistics
const getProfileStats = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  const stats = await prisma.$transaction(async (tx) => {
    const [
      totalReports,
      activeReports,
      resolvedReports,
      finderReports,
      totalMatches,
      recentActivity
    ] = await Promise.all([
      // Total parent reports
      tx.parentReport.count({
        where: { parentId: userId }
      }),
      
      // Active parent reports
      tx.parentReport.count({
        where: { 
          parentId: userId,
          status: { in: ['ACTIVE'] }
        }
      }),
      
      // Resolved parent reports
      tx.parentReport.count({
        where: { 
          parentId: userId,
          status: { in: ['RESOLVED', 'CLOSED'] }
        }
      }),
      
      // Total finder reports
      tx.finderReport.count({
        where: { finderId: userId }
      }),
      
      // Total matches involving user's reports
      tx.matchedCase.count({
        where: {
          OR: [
            { parentCase: { parentId: userId } },
            { finderCase: { finderId: userId } }
          ]
        }
      }),
      
      // Recent activity (last 30 days)
      tx.parentReport.count({
        where: {
          parentId: userId,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    return {
      parentReports: {
        total: totalReports,
        active: activeReports,
        resolved: resolvedReports
      },
      finderReports: {
        total: finderReports
      },
      matches: {
        total: totalMatches
      },
      activity: {
        recentReports: recentActivity
      }
    };
  });

  res.json({
    success: true,
    data: { stats }
  });
});

// Get user's parent reports
const getParentReports = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { page = 1, limit = 10, status } = req.query;
  const skip = (page - 1) * limit;

  const where = {
    parentId: userId
  };

  if (status) {
    where.status = status.toUpperCase();
  }

  const [reports, total] = await Promise.all([
    prisma.parentReport.findMany({
      where,
      include: {
        images: {
          select: {
            id: true,
            imageUrl: true
          }
        }
      },
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' }
    }),
    prisma.parentReport.count({ where })
  ]);

  res.json({
    success: true,
    data: {
      reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// Get user's finder reports
const getFinderReports = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { page = 1, limit = 10, status } = req.query;
  const skip = (page - 1) * limit;

  const where = {
    finderId: userId
  };

  if (status) {
    where.status = status.toUpperCase();
  }

  const [reports, total] = await Promise.all([
    prisma.finderReport.findMany({
      where,
      include: {
        images: {
          select: {
            id: true,
            imageUrl: true
          }
        }
      },
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' }
    }),
    prisma.finderReport.count({ where })
  ]);

  res.json({
    success: true,
    data: {
      reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// Get user's matches
const getMatches = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { page = 1, limit = 10, status } = req.query;
  const skip = (page - 1) * limit;

  const where = {
    OR: [
      { parentCase: { parentId: userId } },
      { finderCase: { finderId: userId } }
    ]
  };

  if (status) {
    where.status = status.toUpperCase();
  }

  const [matches, total] = await Promise.all([
    prisma.matchedCase.findMany({
      where,
      include: {
        parentCase: {
          select: {
            id: true,
            childName: true,
            status: true,
            parentId: true,
            images: {
              select: {
                imageUrl: true
              },
              take: 1
            }
          }
        },
        finderCase: {
          select: {
            id: true,
            placeFound: true,
            status: true,
            finderId: true,
            images: {
              select: {
                imageUrl: true
              },
              take: 1
            }
          }
        }
      },
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' }
    }),
    prisma.matchedCase.count({ where })
  ]);

  res.json({
    success: true,
    data: {
      matches,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// Get user's notifications
const getNotifications = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { page = 1, limit = 20, unreadOnly = false } = req.query;
  const skip = (page - 1) * limit;

  const where = {
    userId
  };

  if (unreadOnly === 'true') {
    where.isRead = false;
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
const markNotificationRead = asyncHandler(async (req, res) => {
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
    data: { isRead: true }
  });

  res.json({
    success: true,
    message: 'Notification marked as read'
  });
});

// Mark all notifications as read
const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false
    },
    data: { isRead: true }
  });

  res.json({
    success: true,
    message: 'All notifications marked as read'
  });
});

module.exports = {
  getFullProfile,
  getProfileStats,
  getParentReports,
  getFinderReports,
  getMatches,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead
};
