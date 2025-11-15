const { prisma } = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendNotification } = require('../services/notificationService');

// Get all matches
const getMatches = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    status, 
    sortBy = 'createdAt',
    sortOrder = 'desc',
    minSimilarity = 0.7
  } = req.query;
  
  const skip = (page - 1) * limit;

  const where = {
    matchConfidence: { gte: parseFloat(minSimilarity) }
  };

  if (status) {
    where.status = status.toUpperCase();
  }

  const orderBy = {};
  orderBy[sortBy] = sortOrder.toLowerCase();

  const [matches, total] = await Promise.all([
    prisma.matchedCase.findMany({
      where,
      include: {
        parentCase: {
          select: {
            id: true,
            childName: true,
            age: true,
            gender: true,
            placeLost: true,
            lostTime: true,
            status: true,
            parent: {
              select: {
                id: true,
                name: true,
                phone: true
              }
            },
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
            childName: true,
            age: true,
            gender: true,
            placeFound: true,
            foundTime: true,
            status: true,
            finder: {
              select: {
                id: true,
                name: true,
                phone: true
              }
            },
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
      orderBy
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

// Get match by ID
const getMatchById = asyncHandler(async (req, res) => {
  const { matchId } = req.params;

  const match = await prisma.matchedCase.findUnique({
    where: { id: matchId },
    include: {
      parentCase: {
        include: {
          images: {
            select: {
              id: true,
              imageUrl: true,
              fileName: true
            }
          },
          parent: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true
            }
          }
        }
      },
      finderCase: {
        include: {
          images: {
            select: {
              id: true,
              imageUrl: true,
              fileName: true
            }
          },
          finder: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true
            }
          }
        }
      }
    }
  });

  if (!match) {
    return res.status(404).json({
      success: false,
      message: 'Match not found'
    });
  }

  res.json({
    success: true,
    data: { match }
  });
});

// Update match status (Admin only)
const updateMatchStatus = asyncHandler(async (req, res) => {
  const { matchId } = req.params;
  const { status, adminNotes } = req.body;

  const match = await prisma.matchedCase.findUnique({
    where: { id: matchId },
    include: {
      parentReport: {
        select: {
          reportedBy: true,
          childName: true
        }
      },
      finderReport: {
        select: {
          reportedBy: true
        }
      }
    }
  });

  if (!match) {
    return res.status(404).json({
      success: false,
      message: 'Match not found'
    });
  }

  const updateData = {
    status: status.toUpperCase()
  };

  if (adminNotes) {
    updateData.adminNotes = adminNotes;
  }

  if (status.toUpperCase() === 'CONFIRMED') {
    updateData.confirmedAt = new Date();
  }

  const updatedMatch = await prisma.matchedCase.update({
    where: { id: matchId },
    data: updateData,
    include: {
      parentReport: {
        select: {
          id: true,
          childName: true,
          reportedByUser: {
            select: {
              name: true
            }
          }
        }
      },
      finderReport: {
        select: {
          id: true,
          reportedByUser: {
            select: {
              name: true
            }
          }
        }
      }
    }
  });

  // Send notifications to both users
  if (status.toUpperCase() === 'CONFIRMED') {
    // Notify parent
    await sendNotification({
      userId: match.parentReport.reportedBy,
      title: 'Match Confirmed!',
      message: `Your missing child report for ${match.parentReport.childName} has been confirmed as a match!`,
      type: 'MATCH_CONFIRMED',
      data: { matchId, reportType: 'parent' }
    });

    // Notify finder
    await sendNotification({
      userId: match.finderReport.reportedBy,
      title: 'Match Confirmed!',
      message: `Your finder report has been confirmed as a match!`,
      type: 'MATCH_CONFIRMED',
      data: { matchId, reportType: 'finder' }
    });

    // Update both reports to FOUND/RESOLVED
    await Promise.all([
      prisma.parentReport.update({
        where: { id: match.parentReportId },
        data: { 
          status: 'FOUND',
          resolvedAt: new Date()
        }
      }),
      prisma.finderReport.update({
        where: { id: match.finderReportId },
        data: { 
          status: 'RESOLVED',
          resolvedAt: new Date()
        }
      })
    ]);
  } else if (status.toUpperCase() === 'REJECTED') {
    // Notify both users
    await sendNotification({
      userId: match.parentReport.reportedBy,
      title: 'Match Update',
      message: `A potential match for ${match.parentReport.childName} was reviewed but not confirmed.`,
      type: 'MATCH_REJECTED',
      data: { matchId, reportType: 'parent' }
    });

    await sendNotification({
      userId: match.finderReport.reportedBy,
      title: 'Match Update',
      message: `A potential match for your finder report was reviewed but not confirmed.`,
      type: 'MATCH_REJECTED',
      data: { matchId, reportType: 'finder' }
    });
  }

  res.json({
    success: true,
    message: 'Match status updated successfully',
    data: { match: updatedMatch }
  });
});

// Get matches for a specific user
const getUserMatches = asyncHandler(async (req, res) => {
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
            age: true,
            gender: true,
            placeLost: true,
            lostTime: true,
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
            childName: true,
            age: true,
            gender: true,
            placeFound: true,
            foundTime: true,
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

// Delete match (Admin only)
const deleteMatch = asyncHandler(async (req, res) => {
  const { matchId } = req.params;

  const match = await prisma.matchedCase.findUnique({
    where: { id: matchId }
  });

  if (!match) {
    return res.status(404).json({
      success: false,
      message: 'Match not found'
    });
  }

  await prisma.matchedCase.delete({
    where: { id: matchId }
  });

  res.json({
    success: true,
    message: 'Match deleted successfully'
  });
});

// Get match statistics
const getMatchStats = asyncHandler(async (req, res) => {
  const stats = await prisma.$transaction(async (tx) => {
    const [
      totalMatches,
      pendingMatches,
      matchedMatches,
      rejectedMatches,
      recentMatches
    ] = await Promise.all([
      tx.matchedCase.count(),
      tx.matchedCase.count({
        where: { status: 'PENDING' }
      }),
      tx.matchedCase.count({
        where: { status: 'MATCHED' }
      }),
      tx.matchedCase.count({
        where: { status: 'REJECTED' }
      }),
      tx.matchedCase.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    return {
      total: totalMatches,
      pending: pendingMatches,
      matched: matchedMatches,
      rejected: rejectedMatches,
      recentMatches,
      confirmationRate: totalMatches > 0 ? (matchedMatches / totalMatches * 100).toFixed(2) : 0
    };
  });

  res.json({
    success: true,
    data: { stats }
  });
});

module.exports = {
  getMatches,
  getMatchById,
  updateMatchStatus,
  getUserMatches,
  deleteMatch,
  getMatchStats
};
