const { prisma } = require('../config/db');
const { calculateSimilarity } = require('./imageMatchingService');
const { sendNotification } = require('./notificationService');

/**
 * Find potential matches for a report
 * @param {string} reportId - The ID of the report to find matches for
 * @param {string} reportType - 'PARENT' or 'FINDER'
 */
const findMatches = async (reportId, reportType) => {
  try {
    let sourceReport, targetReports;

    if (reportType === 'PARENT') {
      // Find matches for parent report against finder reports
      sourceReport = await prisma.parentReport.findUnique({
        where: { id: reportId },
        include: {
          images: {
            select: {
              id: true,
              embeddingVector: true,
              imageUrl: true
            }
          }
        }
      });

      if (!sourceReport) {
        throw new Error('Parent report not found');
      }

      // Get all active finder reports
      targetReports = await prisma.finderReport.findMany({
        where: {
          status: 'ACTIVE',
          id: { not: reportId } // Don't match with self
        },
        include: {
          images: {
            select: {
              id: true,
              embeddingVector: true,
              imageUrl: true
            }
          }
        }
      });

    } else if (reportType === 'FINDER') {
      // Find matches for finder report against parent reports
      sourceReport = await prisma.finderReport.findUnique({
        where: { id: reportId },
        include: {
          images: {
            select: {
              id: true,
              embeddingVector: true,
              imageUrl: true
            }
          }
        }
      });

      if (!sourceReport) {
        throw new Error('Finder report not found');
      }

      // Get all active parent reports
      targetReports = await prisma.parentReport.findMany({
        where: {
          status: 'ACTIVE',
          id: { not: reportId }
        },
        include: {
          images: {
            select: {
              id: true,
              embeddingVector: true,
              imageUrl: true
            }
          }
        }
      });
    } else {
      throw new Error('Invalid report type');
    }

    const matches = [];
    const SIMILARITY_THRESHOLD = 0.7; // Minimum similarity score for a match

    // Compare source report images with target report images
    for (const targetReport of targetReports) {
      let bestSimilarity = 0;
      let matchedImages = [];

      for (const sourceImage of sourceReport.images) {
        if (!sourceImage.embeddingVector || sourceImage.embeddingVector.length === 0) continue;

        for (const targetImage of targetReport.images) {
          if (!targetImage.embeddingVector || targetImage.embeddingVector.length === 0) continue;

          try {
            const similarity = calculateSimilarity(sourceImage.embeddingVector, targetImage.embeddingVector);
            
            if (similarity > bestSimilarity) {
              bestSimilarity = similarity;
              matchedImages = [
                { sourceImageId: sourceImage.id, targetImageId: targetImage.id }
              ];
            }
          } catch (error) {
            console.error('Error calculating similarity:', error);
          }
        }
      }

      // If similarity is above threshold, create a match
      if (bestSimilarity >= SIMILARITY_THRESHOLD) {
        const matchData = reportType === 'PARENT' ? {
          parentCaseId: reportId,
          finderCaseId: targetReport.id,
          matchConfidence: bestSimilarity,
          status: 'PENDING'
        } : {
          parentCaseId: targetReport.id,
          finderCaseId: reportId,
          matchConfidence: bestSimilarity,
          status: 'PENDING'
        };

        // Check if match already exists
        const existingMatch = await prisma.matchedCase.findFirst({
          where: {
            parentCaseId: matchData.parentCaseId,
            finderCaseId: matchData.finderCaseId
          }
        });

        if (!existingMatch) {
          const newMatch = await prisma.matchedCase.create({
            data: matchData,
            include: {
              parentCase: {
                select: {
                  childName: true,
                  parentId: true
                }
              },
              finderCase: {
                select: {
                  additionalDetails: true,
                  finderId: true
                }
              }
            }
          });

          matches.push(newMatch);

          // Send notifications to both users
          await sendNotification({
            userId: newMatch.parentCase.parentId,
            title: 'Potential Match Found!',
            message: `A potential match has been found for ${newMatch.parentCase.childName}. Please check your matches.`,
            type: 'MATCH_FOUND',
            data: { 
              matchId: newMatch.id, 
              reportType: 'parent',
              matchConfidence: bestSimilarity 
            }
          });

          await sendNotification({
            userId: newMatch.finderCase.finderId,
            title: 'Potential Match Found!',
            message: 'Your finder report has been matched with a missing child report.',
            type: 'MATCH_FOUND',
            data: { 
              matchId: newMatch.id, 
              reportType: 'finder',
              matchConfidence: bestSimilarity 
            }
          });

          // Send notification to admin
          await sendNotification({
            userId: null, // Admin notification
            title: 'New Match Found',
            message: `A new potential match (${(bestSimilarity * 100).toFixed(1)}% similarity) needs review`,
            type: 'ADMIN_ALERT',
            data: { 
              matchId: newMatch.id,
              matchConfidence: bestSimilarity
            }
          });
        }
      }
    }

    console.log(`Found ${matches.length} new matches for ${reportType} report ${reportId}`);
    return matches;

  } catch (error) {
    console.error('Error finding matches:', error);
    throw error;
  }
};

/**
 * Get case statistics
 * @param {string} userId - Optional user ID to filter by user's cases
 */
const getCaseStatistics = async (userId = null) => {
  try {
    const where = userId ? { parentId: userId } : {};

    const stats = await prisma.$transaction(async (tx) => {
      const [
        totalParentReports,
        activeParentReports,
        resolvedParentReports,
        totalFinderReports,
        activeFinderReports,
        totalMatches,
        confirmedMatches,
        recentCases
      ] = await Promise.all([
        tx.parentReport.count({ where }),
        tx.parentReport.count({
          where: {
            ...where,
            status: 'ACTIVE'
          }
        }),
        tx.parentReport.count({
          where: {
            ...where,
            status: { in: ['RESOLVED', 'CLOSED'] }
          }
        }),
        tx.finderReport.count({ where: userId ? { finderId: userId } : {} }),
        tx.finderReport.count({
          where: {
            ...(userId ? { finderId: userId } : {}),
            status: 'ACTIVE'
          }
        }),
        userId ? tx.matchedCase.count({
          where: {
            OR: [
              { parentCase: { parentId: userId } },
              { finderCase: { finderId: userId } }
            ]
          }
        }) : tx.matchedCase.count(),
        userId ? tx.matchedCase.count({
          where: {
            status: 'MATCHED',
            OR: [
              { parentCase: { parentId: userId } },
              { finderCase: { finderId: userId } }
            ]
          }
        }) : tx.matchedCase.count({
          where: { status: 'MATCHED' }
        }),
        tx.parentReport.count({
          where: {
            ...where,
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          }
        })
      ]);

      const successRate = totalParentReports > 0 ? 
        (resolvedParentReports / totalParentReports * 100).toFixed(2) : 0;

      return {
        parentReports: {
          total: totalParentReports,
          active: activeParentReports,
          resolved: resolvedParentReports
        },
        finderReports: {
          total: totalFinderReports,
          active: activeFinderReports
        },
        matches: {
          total: totalMatches,
          confirmed: confirmedMatches,
          pending: totalMatches - confirmedMatches
        },
        metrics: {
          successRate: parseFloat(successRate),
          recentActivity: recentCases
        }
      };
    });

    return stats;
  } catch (error) {
    console.error('Error getting case statistics:', error);
    throw error;
  }
};

/**
 * Update case status
 * @param {string} caseId - Case ID
 * @param {string} caseType - 'PARENT' or 'FINDER'
 * @param {string} status - New status
 * @param {string} adminNotes - Optional admin notes
 */
const updateCaseStatus = async (caseId, caseType, status, adminNotes = null) => {
  try {
    const updateData = {
      status: status.toUpperCase()
    };

    if (adminNotes) {
      updateData.adminNotes = adminNotes;
    }

    if (['FOUND', 'RESOLVED', 'FALSE_ALARM'].includes(status.toUpperCase())) {
      updateData.resolvedAt = new Date();
    }

    let updatedCase;
    if (caseType === 'PARENT') {
      updatedCase = await prisma.parentReport.update({
        where: { id: caseId },
        data: updateData,
        include: {
          reportedByUser: {
            select: { id: true, name: true }
          }
        }
      });

      // Send notification to user
      await sendNotification({
        userId: updatedCase.reportedBy,
        title: 'Case Status Updated',
        message: `Your missing child report for ${updatedCase.childName} has been updated to ${status}`,
        type: 'STATUS_UPDATE',
        data: { caseId, caseType: 'parent', newStatus: status }
      });

    } else if (caseType === 'FINDER') {
      updatedCase = await prisma.finderReport.update({
        where: { id: caseId },
        data: updateData,
        include: {
          reportedByUser: {
            select: { id: true, name: true }
          }
        }
      });

      // Send notification to user
      await sendNotification({
        userId: updatedCase.reportedBy,
        title: 'Case Status Updated',
        message: `Your finder report has been updated to ${status}`,
        type: 'STATUS_UPDATE',
        data: { caseId, caseType: 'finder', newStatus: status }
      });
    } else {
      throw new Error('Invalid case type');
    }

    return updatedCase;
  } catch (error) {
    console.error('Error updating case status:', error);
    throw error;
  }
};

/**
 * Get similar cases based on location and time
 * @param {string} location - Location to search around
 * @param {Date} dateTime - Date and time to search around
 * @param {number} radiusKm - Radius in kilometers (for future geo search)
 * @param {number} hourRange - Time range in hours
 */
const getSimilarCases = async (location, dateTime, radiusKm = 10, hourRange = 48) => {
  try {
    const startTime = new Date(dateTime.getTime() - hourRange * 60 * 60 * 1000);
    const endTime = new Date(dateTime.getTime() + hourRange * 60 * 60 * 1000);

    // For now, we'll do a simple text-based location search
    // In the future, this could be enhanced with proper geospatial queries
    const similarCases = await prisma.parentReport.findMany({
      where: {
        lastSeenLocation: {
          contains: location,
          mode: 'insensitive'
        },
        lastSeenDateTime: {
          gte: startTime,
          lte: endTime
        },
        status: { in: ['ACTIVE', 'UNDER_INVESTIGATION'] }
      },
      include: {
        caseImages: {
          where: { isPrimary: true },
          select: {
            imageUrl: true
          },
          take: 1
        },
        reportedByUser: {
          select: {
            name: true,
            phone: true
          }
        }
      },
      orderBy: {
        lastSeenDateTime: 'desc'
      }
    });

    return similarCases;
  } catch (error) {
    console.error('Error getting similar cases:', error);
    throw error;
  }
};

/**
 * Archive old resolved cases
 * @param {number} daysOld - Archive cases older than this many days
 */
const archiveOldCases = async (daysOld = 365) => {
  try {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    const [archivedParentReports, archivedFinderReports] = await Promise.all([
      prisma.parentReport.updateMany({
        where: {
          resolvedAt: {
            lt: cutoffDate
          },
          status: { in: ['FOUND', 'FALSE_ALARM'] }
        },
        data: {
          archived: true
        }
      }),
      prisma.finderReport.updateMany({
        where: {
          resolvedAt: {
            lt: cutoffDate
          },
          status: 'RESOLVED'
        },
        data: {
          archived: true
        }
      })
    ]);

    console.log(`Archived ${archivedParentReports.count} parent reports and ${archivedFinderReports.count} finder reports`);
    
    return {
      parentReports: archivedParentReports.count,
      finderReports: archivedFinderReports.count
    };
  } catch (error) {
    console.error('Error archiving old cases:', error);
    throw error;
  }
};

module.exports = {
  findMatches,
  getCaseStatistics,
  updateCaseStatus,
  getSimilarCases,
  archiveOldCases
};
