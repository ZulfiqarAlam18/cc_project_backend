const { prisma } = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  compareReportImages,
  compareTwoFaces,
  checkServiceHealth
} = require('../services/faceMatchingService');
const { sendNotification } = require('../services/notificationService');

/**
 * Check face matching service health
 */
const checkFaceMatchService = asyncHandler(async (req, res) => {
  const isHealthy = await checkServiceHealth();
  
  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    message: isHealthy 
      ? 'Face matching service is running' 
      : 'Face matching service is unavailable',
    service: 'face-matching'
  });
});

/**
 * Compare two images directly
 */
const compareTwoImages = asyncHandler(async (req, res) => {
  const { image1Url, image2Url, tolerance } = req.body;

  if (!image1Url || !image2Url) {
    return res.status(400).json({
      success: false,
      message: 'Both image1Url and image2Url are required'
    });
  }

  const result = await compareTwoFaces(image1Url, image2Url, tolerance);

  res.json({
    success: result.success,
    match: result.match,
    confidence: result.confidence,
    distance: result.distance,
    error: result.error
  });
});

/**
 * Find matches between a parent report and all finder reports
 */
const findMatchesForParentReport = asyncHandler(async (req, res) => {
  const { parentReportId } = req.params;
  const { minConfidence = 85 } = req.body;

  // Get parent report with images
  const parentReport = await prisma.parentReport.findUnique({
    where: { id: parentReportId },
    include: {
      images: {
        select: {
          id: true,
          imageUrl: true
        }
      },
      parent: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  });

  if (!parentReport) {
    return res.status(404).json({
      success: false,
      message: 'Parent report not found'
    });
  }

  if (parentReport.images.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Parent report has no images to match'
    });
  }

  // Get all active finder reports with images
  const finderReports = await prisma.finderReport.findMany({
    where: {
      status: 'ACTIVE'
    },
    include: {
      images: {
        select: {
          id: true,
          imageUrl: true
        }
      },
      finder: {
        select: {
          id: true,
          name: true,
          phone: true
        }
      }
    }
  });

  const matches = [];

  // Compare parent report images with each finder report
  for (const finderReport of finderReports) {
    if (finderReport.images.length === 0) continue;

    const matchResult = await compareReportImages(
      parentReport.images,
      finderReport.images,
      minConfidence
    );

    if (matchResult.matched) {
      // Create match record in database
      const existingMatch = await prisma.matchedCase.findFirst({
        where: {
          parentCaseId: parentReportId,
          finderCaseId: finderReport.id
        }
      });

      let matchRecord;

      if (existingMatch) {
        // Update existing match
        matchRecord = await prisma.matchedCase.update({
          where: { id: existingMatch.id },
          data: {
            matchConfidence: matchResult.confidence,
            status: 'MATCHED',
            updatedAt: new Date()
          }
        });
      } else {
        // Create new match
        matchRecord = await prisma.matchedCase.create({
          data: {
            parentCaseId: parentReportId,
            finderCaseId: finderReport.id,
            matchConfidence: matchResult.confidence,
            status: 'MATCHED',
            notificationSent: false
          }
        });
      }

      // Send notifications
      try {
        // Notify parent
        await sendNotification({
          userId: parentReport.parent.id,
          type: 'MATCH_FOUND',
          title: 'Potential Match Found!',
          message: `A potential match has been found for ${parentReport.childName} with ${matchResult.confidence.toFixed(2)}% confidence.`,
          data: {
            matchId: matchRecord.id,
            finderReportId: finderReport.id,
            confidence: matchResult.confidence
          }
        });

        // Notify finder
        await sendNotification({
          userId: finderReport.finder.id,
          type: 'MATCH_FOUND',
          title: 'Potential Match Found!',
          message: `Your found child report has been matched with a missing child report with ${matchResult.confidence.toFixed(2)}% confidence.`,
          data: {
            matchId: matchRecord.id,
            parentReportId: parentReportId,
            confidence: matchResult.confidence
          }
        });

        // Update notification sent flag
        await prisma.matchedCase.update({
          where: { id: matchRecord.id },
          data: { notificationSent: true }
        });
      } catch (notifError) {
        console.error('Error sending notifications:', notifError);
      }

      matches.push({
        matchId: matchRecord.id,
        finderReportId: finderReport.id,
        finderName: finderReport.finder.name,
        finderPhone: finderReport.finder.phone,
        confidence: matchResult.confidence,
        parentImageUrl: matchResult.parentImageUrl,
        finderImageUrl: matchResult.finderImageUrl,
        status: matchRecord.status
      });
    }
  }

  res.json({
    success: true,
    message: `Found ${matches.length} potential matches`,
    parentReportId,
    childName: parentReport.childName,
    matchesFound: matches.length,
    matches
  });
});

/**
 * Find matches for a finder report against all parent reports
 */
const findMatchesForFinderReport = asyncHandler(async (req, res) => {
  const { finderReportId } = req.params;
  const { minConfidence = 85 } = req.body;

  // Get finder report with images
  const finderReport = await prisma.finderReport.findUnique({
    where: { id: finderReportId },
    include: {
      images: {
        select: {
          id: true,
          imageUrl: true
        }
      },
      finder: {
        select: {
          id: true,
          name: true,
          phone: true
        }
      }
    }
  });

  if (!finderReport) {
    return res.status(404).json({
      success: false,
      message: 'Finder report not found'
    });
  }

  if (finderReport.images.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Finder report has no images to match'
    });
  }

  // Get all active parent reports with images
  const parentReports = await prisma.parentReport.findMany({
    where: {
      status: 'ACTIVE'
    },
    include: {
      images: {
        select: {
          id: true,
          imageUrl: true
        }
      },
      parent: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  });

  const matches = [];

  // Compare finder report images with each parent report
  for (const parentReport of parentReports) {
    if (parentReport.images.length === 0) continue;

    const matchResult = await compareReportImages(
      parentReport.images,
      finderReport.images,
      minConfidence
    );

    if (matchResult.matched) {
      // Create or update match record
      const existingMatch = await prisma.matchedCase.findFirst({
        where: {
          parentCaseId: parentReport.id,
          finderCaseId: finderReportId
        }
      });

      let matchRecord;

      if (existingMatch) {
        matchRecord = await prisma.matchedCase.update({
          where: { id: existingMatch.id },
          data: {
            matchConfidence: matchResult.confidence,
            status: 'MATCHED',
            updatedAt: new Date()
          }
        });
      } else {
        matchRecord = await prisma.matchedCase.create({
          data: {
            parentCaseId: parentReport.id,
            finderCaseId: finderReportId,
            matchConfidence: matchResult.confidence,
            status: 'MATCHED',
            notificationSent: false
          }
        });
      }

      // Send notifications
      try {
        await sendNotification({
          userId: parentReport.parent.id,
          type: 'MATCH_FOUND',
          title: 'Potential Match Found!',
          message: `A potential match has been found for ${parentReport.childName} with ${matchResult.confidence.toFixed(2)}% confidence.`,
          data: {
            matchId: matchRecord.id,
            finderReportId: finderReportId,
            confidence: matchResult.confidence
          }
        });

        await sendNotification({
          userId: finderReport.finder.id,
          type: 'MATCH_FOUND',
          title: 'Potential Match Found!',
          message: `Your found child report has been matched with ${matchResult.confidence.toFixed(2)}% confidence.`,
          data: {
            matchId: matchRecord.id,
            parentReportId: parentReport.id,
            confidence: matchResult.confidence
          }
        });

        await prisma.matchedCase.update({
          where: { id: matchRecord.id },
          data: { notificationSent: true }
        });
      } catch (notifError) {
        console.error('Error sending notifications:', notifError);
      }

      matches.push({
        matchId: matchRecord.id,
        parentReportId: parentReport.id,
        childName: parentReport.childName,
        parentName: parentReport.parent.name,
        confidence: matchResult.confidence,
        parentImageUrl: matchResult.parentImageUrl,
        finderImageUrl: matchResult.finderImageUrl,
        status: matchRecord.status
      });
    }
  }

  res.json({
    success: true,
    message: `Found ${matches.length} potential matches`,
    finderReportId,
    matchesFound: matches.length,
    matches
  });
});

/**
 * Manually compare specific parent and finder reports
 */
const compareSpecificReports = asyncHandler(async (req, res) => {
  const { parentReportId, finderReportId, minConfidence = 85 } = req.body;

  if (!parentReportId || !finderReportId) {
    return res.status(400).json({
      success: false,
      message: 'Both parentReportId and finderReportId are required'
    });
  }

  // Get both reports with images
  const [parentReport, finderReport] = await Promise.all([
    prisma.parentReport.findUnique({
      where: { id: parentReportId },
      include: {
        images: { select: { id: true, imageUrl: true } },
        parent: { select: { id: true, name: true } }
      }
    }),
    prisma.finderReport.findUnique({
      where: { id: finderReportId },
      include: {
        images: { select: { id: true, imageUrl: true } },
        finder: { select: { id: true, name: true } }
      }
    })
  ]);

  if (!parentReport || !finderReport) {
    return res.status(404).json({
      success: false,
      message: 'One or both reports not found'
    });
  }

  if (parentReport.images.length === 0 || finderReport.images.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Both reports must have at least one image'
    });
  }

  // Compare images
  const matchResult = await compareReportImages(
    parentReport.images,
    finderReport.images,
    minConfidence
  );

  if (matchResult.matched) {
    // Create or update match
    const existingMatch = await prisma.matchedCase.findFirst({
      where: {
        parentCaseId: parentReportId,
        finderCaseId: finderReportId
      }
    });

    let matchRecord;

    if (existingMatch) {
      matchRecord = await prisma.matchedCase.update({
        where: { id: existingMatch.id },
        data: {
          matchConfidence: matchResult.confidence,
          status: 'MATCHED',
          updatedAt: new Date()
        }
      });
    } else {
      matchRecord = await prisma.matchedCase.create({
        data: {
          parentCaseId: parentReportId,
          finderCaseId: finderReportId,
          matchConfidence: matchResult.confidence,
          status: 'MATCHED',
          notificationSent: false
        }
      });
    }

    res.json({
      success: true,
      matched: true,
      matchId: matchRecord.id,
      confidence: matchResult.confidence,
      parentImageUrl: matchResult.parentImageUrl,
      finderImageUrl: matchResult.finderImageUrl,
      message: 'Reports matched successfully'
    });
  } else {
    res.json({
      success: true,
      matched: false,
      confidence: matchResult.confidence,
      message: 'No match found between the reports'
    });
  }
});

module.exports = {
  checkFaceMatchService,
  compareTwoImages,
  findMatchesForParentReport,
  findMatchesForFinderReport,
  compareSpecificReports
};
