const { prisma } = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');

// Get general dashboard statistics
const getDashboardStats = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const userRole = req.user.role;

  if (userRole === 'ADMIN') {
    // Admin dashboard - system-wide statistics
    const stats = await prisma.$transaction(async (tx) => {
      const [
        totalUsers,
        totalParentReports,
        totalFinderReports,
        totalMatches,
        activeParentReports,
        activeFinderReports,
        confirmedMatches,
        recentUsers,
        recentReports,
        resolvedCases
      ] = await Promise.all([
        tx.user.count({ where: { isActive: true } }),
        tx.parentReport.count(),
        tx.finderReport.count(),
        tx.matchedCase.count(),
        tx.parentReport.count({
          where: { status: 'ACTIVE' }
        }),
        tx.finderReport.count({
          where: { status: 'ACTIVE' }
        }),
        tx.matchedCase.count({
          where: { status: 'MATCHED' }
        }),
        tx.user.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          }
        }),
        tx.parentReport.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          }
        }),
        tx.parentReport.count({
          where: { status: { in: ['RESOLVED', 'CLOSED'] } }
        })
      ]);

      const successRate = totalParentReports > 0 ? 
        ((resolvedCases / totalParentReports) * 100).toFixed(2) : 0;

      return {
        overview: {
          totalUsers,
          totalReports: totalParentReports + totalFinderReports,
          totalMatches,
          activeReports: activeParentReports + activeFinderReports,
          successRate: parseFloat(successRate)
        },
        reports: {
          parentReports: {
            total: totalParentReports,
            active: activeParentReports,
            resolved: resolvedCases
          },
          finderReports: {
            total: totalFinderReports,
            active: activeFinderReports
          }
        },
        matches: {
          total: totalMatches,
          confirmed: confirmedMatches,
          pending: totalMatches - confirmedMatches
        },
        recent: {
          newUsers: recentUsers,
          newReports: recentReports
        }
      };
    });

    res.json({
      success: true,
      data: { stats }
    });
  } else {
    // User dashboard - personal statistics
    const stats = await prisma.$transaction(async (tx) => {
      const [
        parentReports,
        finderReports,
        totalMatches,
        activeParentReports,
        activeFinderReports,
        resolvedParentReports,
        recentActivity,
        unreadNotifications
      ] = await Promise.all([
        tx.parentReport.count({
          where: { reportedBy: userId }
        }),
        tx.finderReport.count({
          where: { reportedBy: userId }
        }),
        tx.matchedCase.count({
          where: {
            OR: [
              { parentReport: { reportedBy: userId } },
              { finderReport: { reportedBy: userId } }
            ]
          }
        }),
        tx.parentReport.count({
          where: { 
            parentId: userId,
            status: 'ACTIVE'
          }
        }),
        tx.finderReport.count({
          where: { 
            finderId: userId,
            status: 'ACTIVE'
          }
        }),
        tx.parentReport.count({
          where: { 
            parentId: userId,
            status: { in: ['RESOLVED', 'CLOSED'] }
          }
        }),
        tx.parentReport.count({
          where: {
            reportedBy: userId,
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          }
        }),
        tx.notification.count({
          where: {
            userId,
            isRead: false
          }
        })
      ]);

      return {
        reports: {
          parent: {
            total: parentReports,
            active: activeParentReports,
            resolved: resolvedParentReports
          },
          finder: {
            total: finderReports,
            active: activeFinderReports
          }
        },
        matches: {
          total: totalMatches
        },
        activity: {
          recentReports: recentActivity,
          unreadNotifications
        }
      };
    });

    res.json({
      success: true,
      data: { stats }
    });
  }
});

// Get recent activity (last 7 days)
const getRecentActivity = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const userRole = req.user.role;
  const { limit = 10 } = req.query;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  if (userRole === 'ADMIN') {
    // Admin - system-wide recent activity
    const [recentParentReports, recentFinderReports, recentMatches, recentUsers] = await Promise.all([
      prisma.parentReport.findMany({
        where: {
          createdAt: { gte: sevenDaysAgo }
        },
        select: {
          id: true,
          childName: true,
          status: true,
          createdAt: true,
          parent: {
            select: {
              name: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit)
      }),
      prisma.finderReport.findMany({
        where: {
          createdAt: { gte: sevenDaysAgo }
        },
        select: {
          id: true,
          childName: true,
          status: true,
          placeFound: true,
          createdAt: true,
          finder: {
            select: {
              name: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit)
      }),
      prisma.matchedCase.findMany({
        where: {
          createdAt: { gte: sevenDaysAgo }
        },
        select: {
          id: true,
          status: true,
          matchConfidence: true,
          createdAt: true,
          parentCase: {
            select: {
              childName: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit)
      }),
      prisma.user.findMany({
        where: {
          createdAt: { gte: sevenDaysAgo }
        },
        select: {
          id: true,
          name: true,
          role: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit)
      })
    ]);

    res.json({
      success: true,
      data: {
        recentActivity: {
          parentReports: recentParentReports,
          finderReports: recentFinderReports,
          matches: recentMatches,
          users: recentUsers
        }
      }
    });
  } else {
    // User - personal recent activity
    const [recentParentReports, recentFinderReports, recentMatches] = await Promise.all([
      prisma.parentReport.findMany({
        where: {
          reportedBy: userId,
          createdAt: { gte: sevenDaysAgo }
        },
        select: {
          id: true,
          childName: true,
          status: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit)
      }),
      prisma.finderReport.findMany({
        where: {
          finderId: userId,
          createdAt: { gte: sevenDaysAgo }
        },
        select: {
          id: true,
          childName: true,
          status: true,
          placeFound: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit)
      }),
      prisma.matchedCase.findMany({
        where: {
          OR: [
            { parentReport: { reportedBy: userId } },
            { finderReport: { reportedBy: userId } }
          ],
          createdAt: { gte: sevenDaysAgo }
        },
        select: {
          id: true,
          status: true,
          matchConfidence: true,
          createdAt: true,
          parentCase: {
            select: {
              childName: true,
              reportedBy: true
            }
          },
          finderReport: {
            select: {
              childName: true,
              finderId: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit)
      })
    ]);

    res.json({
      success: true,
      data: {
        recentActivity: {
          parentReports: recentParentReports,
          finderReports: recentFinderReports,
          matches: recentMatches
        }
      }
    });
  }
});

// Get analytics data for charts
const getAnalytics = asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;
  const userRole = req.user.role;

  if (userRole !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }

  // Calculate date range based on period
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
    case '1y':
      daysBack = 365;
      break;
    default:
      daysBack = 30;
  }

  const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  const analytics = await prisma.$transaction(async (tx) => {
    // Reports over time
    const reportsOverTime = await tx.parentReport.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: { gte: startDate }
      },
      _count: {
        id: true
      }
    });

    // Status distribution
    const statusDistribution = await tx.parentReport.groupBy({
      by: ['status'],
      _count: {
        id: true
      }
    });

    // Gender distribution
    const genderDistribution = await tx.parentReport.groupBy({
      by: ['gender'],
      _count: {
        id: true
      }
    });

    // Age distribution
    const ageDistribution = await tx.parentReport.groupBy({
      by: ['age'],
      _count: {
        id: true
      }
    });

    // Match success rate over time
    const matchData = await tx.matchedCase.findMany({
      where: {
        createdAt: { gte: startDate }
      },
      select: {
        status: true,
        createdAt: true,
        verifiedAt: true
      }
    });

    return {
      reportsOverTime: reportsOverTime.map(item => ({
        date: item.createdAt.toISOString().split('T')[0],
        count: item._count.id
      })),
      statusDistribution: statusDistribution.map(item => ({
        status: item.status,
        count: item._count.id
      })),
      genderDistribution: genderDistribution.map(item => ({
        gender: item.gender,
        count: item._count.id
      })),
      ageDistribution: ageDistribution.map(item => ({
        age: item.age,
        count: item._count.id
      })),
      matchAnalytics: {
        total: matchData.length,
        confirmed: matchData.filter(m => m.status === 'MATCHED').length,
        pending: matchData.filter(m => m.status === 'PENDING').length,
        rejected: matchData.filter(m => m.status === 'REJECTED').length
      }
    };
  });

  res.json({
    success: true,
    data: { analytics }
  });
});

// Get top locations for missing children reports
const getTopLocations = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  const userRole = req.user.role;

  if (userRole !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }

  const locations = await prisma.parentReport.groupBy({
    by: ['placeLost'],
    _count: {
      id: true
    },
    orderBy: {
      _count: {
        id: 'desc'
      }
    },
    take: parseInt(limit)
  });

  res.json({
    success: true,
    data: {
      locations: locations.map(item => ({
        location: item.placeLost,
        count: item._count.id
      }))
    }
  });
});

// Get system health metrics
const getSystemHealth = asyncHandler(async (req, res) => {
  const userRole = req.user.role;

  if (userRole !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }

  const health = await prisma.$transaction(async (tx) => {
    const [
      totalActiveUsers,
      recentActivity,
      pendingMatches,
      unprocessedImages,
      systemErrors
    ] = await Promise.all([
      tx.user.count({
        where: {
          isActive: true,
          lastLogin: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      tx.parentReport.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      }),
      tx.matchedCase.count({
        where: { status: 'PENDING' }
      }),
      tx.caseImage.count({
        where: { 
          embeddingVector: {
            isEmpty: true
          }
        }
      }),
      // This would typically come from a logging system
      Promise.resolve(0)
    ]);

    return {
      activeUsers: totalActiveUsers,
      recentActivity,
      pendingMatches,
      unprocessedImages,
      systemErrors,
      status: 'healthy' // This would be calculated based on various metrics
    };
  });

  res.json({
    success: true,
    data: { health }
  });
});

module.exports = {
  getDashboardStats,
  getRecentActivity,
  getAnalytics,
  getTopLocations,
  getSystemHealth
};
