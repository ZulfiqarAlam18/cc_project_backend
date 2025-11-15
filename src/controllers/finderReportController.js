const { prisma } = require('../config/db');
// const { deleteFromS3 } = require('../config/awsS3'); // Commented out for local storage
const { asyncHandler } = require('../middleware/errorHandler');
const { processImageForMatching } = require('../services/imageMatchingService');
const { findMatches } = require('../services/caseService');
const { sendNotification } = require('../services/notificationService');
const fs = require('fs');
const path = require('path');

// Helper function to delete local files
const deleteLocalFile = async (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('Error deleting local file:', error);
  }
};

// Create finder report
const createFinderReport = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const {
    childName,
    fatherName,
    placeFound,
    gender,
    foundTime,
    additionalDetails,
    contactNumber,
    emergency
  } = req.body;

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'At least one image is required'
    });
  }

  // Debug: Log received foundTime
  console.log('Received foundTime:', foundTime, 'Type:', typeof foundTime);
  
  // Set default foundTime to current time if not provided
  const foundDate = foundTime ? new Date(foundTime) : new Date();
  if (foundTime && isNaN(foundDate.getTime())) {
    return res.status(400).json({
      success: false,
      message: 'foundTime must be a valid ISO date string if provided.'
    });
  }

  // Create finder report
  const finderReport = await prisma.finderReport.create({
    data: {
      childName: childName || null,
      fatherName: fatherName || null,
      gender: gender ? gender.toUpperCase() : null,
      placeFound: placeFound || null,
      foundTime: foundDate,
      additionalDetails: additionalDetails || null,
      contactNumber: contactNumber || null,
      emergency: emergency || null,
      latitude: 0.0, // Default latitude
      longitude: 0.0, // Default longitude
      locationName: null,
      finderId: userId,
      status: 'ACTIVE'
    }
  });

  // Process and save images
  const imagePromises = req.files.map(async (file, index) => {
    // Create case image record
    const caseImage = await prisma.caseImage.create({
      data: {
        imageUrl: file.location || `/uploads/images/${file.filename}`,
        fileName: file.filename,
        fileSize: file.size,
        mimeType: file.mimetype,
        embeddingVector: [], // Empty array, will be populated by background processing
        finderReportId: finderReport.id
      }
    });

    // Process image for matching in background
    try {
      const embeddings = await processImageForMatching(file.location);
      
      await prisma.caseImage.update({
        where: { id: caseImage.id },
        data: { 
          embeddings: JSON.stringify(embeddings),
          processed: true
        }
      });
    } catch (error) {
      console.error('Error processing image:', error);
    }

    return caseImage;
  });

  const caseImages = await Promise.all(imagePromises);

  // Find potential matches in background
  setTimeout(async () => {
    try {
      await findMatches(finderReport.id, 'FINDER');
    } catch (error) {
      console.error('Error finding matches:', error);
    }
  }, 1000);

  // Send notification to admin
  await sendNotification({
    userId: null, // Admin notification
    title: 'New Child Found Report',
    message: `New finder report has been submitted in ${placeFound}`,
    type: 'ADMIN_ALERT',
    data: { reportId: finderReport.id, reportType: 'finder' }
  });

  const result = await prisma.finderReport.findUnique({
    where: { id: finderReport.id },
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
          phone: true
        }
      }
    }
  });

  res.status(201).json({
    success: true,
    message: 'Finder report created successfully',
    data: { report: result }
  });
});

// Get all finder reports
const getFinderReports = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    status, 
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;
  
  const skip = (page - 1) * limit;

  const where = {};

  if (status) {
    where.status = status.toUpperCase();
  }

  if (search) {
    where.OR = [
      { childName: { contains: search, mode: 'insensitive' } },
      { fatherName: { contains: search, mode: 'insensitive' } },
      { placeFound: { contains: search, mode: 'insensitive' } },
      { additionalDetails: { contains: search, mode: 'insensitive' } }
    ];
  }

  const orderBy = {};
  orderBy[sortBy] = sortOrder.toLowerCase();

  const [reports, total] = await Promise.all([
    prisma.finderReport.findMany({
      where,
      include: {
        images: {
          select: {
            id: true,
            imageUrl: true
          },
          take: 1
        },
        finder: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        }
      },
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy
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

// Get finder report by ID
const getFinderReportById = asyncHandler(async (req, res) => {
  const { reportId } = req.params;

  const report = await prisma.finderReport.findUnique({
    where: { id: reportId },
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
      },
      matchesAsFinder: {
        include: {
          parentCase: {
            select: {
              id: true,
              childName: true,
              placeLost: true,
              lostTime: true,
              images: {
                select: {
                  imageUrl: true
                },
                take: 1
              }
            }
          }
        },
        orderBy: { matchConfidence: 'desc' }
      }
    }
  });

  if (!report) {
    return res.status(404).json({
      success: false,
      message: 'Finder report not found'
    });
  }

  res.json({
    success: true,
    data: { report }
  });
});

// Update finder report
const updateFinderReport = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const userId = req.user.userId;
  const userRole = req.user.role;
  
  const {
    childName,
    fatherName,
    placeFound,
    gender,
    foundTime,
    additionalDetails,
    contactNumber,
    emergency,
    status
  } = req.body;

  // Check if report exists
  const existingReport = await prisma.finderReport.findUnique({
    where: { id: reportId }
  });

  if (!existingReport) {
    return res.status(404).json({
      success: false,
      message: 'Finder report not found'
    });
  }

  // Check permissions
  if (userRole !== 'ADMIN' && existingReport.finderId !== userId) {
    return res.status(403).json({
      success: false,
      message: 'You can only update your own reports'
    });
  }

  const updateData = {};
  
  if (childName !== undefined) updateData.childName = childName || null;
  if (fatherName !== undefined) updateData.fatherName = fatherName || null;
  if (placeFound !== undefined) updateData.placeFound = placeFound || null;
  if (gender !== undefined) updateData.gender = gender ? gender.toUpperCase() : null;
  if (foundTime !== undefined) updateData.foundTime = foundTime ? new Date(foundTime) : new Date();
  if (additionalDetails !== undefined) updateData.additionalDetails = additionalDetails || null;
  if (contactNumber !== undefined) updateData.contactNumber = contactNumber || null;
  if (emergency !== undefined) updateData.emergency = emergency || null;
  
  // Only admin can update status
  if (status !== undefined && userRole === 'ADMIN') {
    updateData.status = status.toUpperCase();
  }

  const updatedReport = await prisma.finderReport.update({
    where: { id: reportId },
    data: updateData,
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
          phone: true
        }
      }
    }
  });

  // Send notification if status changed
  if (status && userRole === 'ADMIN') {
    await sendNotification({
      userId: existingReport.reportedBy,
      title: 'Report Status Updated',
      message: `Your finder report has been updated to ${status}`,
      type: 'STATUS_UPDATE',
      data: { reportId, reportType: 'finder', newStatus: status }
    });
  }

  res.json({
    success: true,
    message: 'Finder report updated successfully',
    data: { report: updatedReport }
  });
});

// Delete finder report
const deleteFinderReport = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const userId = req.user.userId;
  const userRole = req.user.role;

  const report = await prisma.finderReport.findUnique({
    where: { id: reportId },
    include: {
      images: true
    }
  });

  if (!report) {
    return res.status(404).json({
      success: false,
      message: 'Finder report not found'
    });
  }

  // Check permissions
  if (userRole !== 'ADMIN' && report.finderId !== userId) {
    return res.status(403).json({
      success: false,
      message: 'You can only delete your own reports'
    });
  }

  // Delete images from local storage
  for (const image of report.images) {
    try {
      // Extract local file path from URL
      const oldFilePath = image.imageUrl.replace(`${req.protocol}://${req.get('host')}`, '');
      const fullPath = path.join(__dirname, '../../', oldFilePath);
      await deleteLocalFile(fullPath);
      // await deleteFromS3(image.imageKey); // AWS S3 deletion - commented out
    } catch (error) {
      console.error('Error deleting image from local storage:', error);
    }
  }

  // Delete report (cascade will handle related records)
  await prisma.finderReport.delete({
    where: { id: reportId }
  });

  res.json({
    success: true,
    message: 'Finder report deleted successfully'
  });
});

// Get user's own finder reports
const getMyFinderReports = asyncHandler(async (req, res) => {
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
          },
          take: 1
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

module.exports = {
  createFinderReport,
  getFinderReports,
  getFinderReportById,
  updateFinderReport,
  deleteFinderReport,
  getMyFinderReports
};
