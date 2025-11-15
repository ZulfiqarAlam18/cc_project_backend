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

// Create parent report
const createParentReport = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const {
    childName,
    fatherName,
    placeLost,
    gender,
    lostTime,
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

  // Create parent report
  const parentReport = await prisma.parentReport.create({
    data: {
      childName,
      fatherName,
      placeLost,
      gender: gender.toUpperCase(),
      lostTime: new Date(lostTime),
      additionalDetails,
      contactNumber,
      emergency,
      latitude: 0.0, // Default latitude
      longitude: 0.0, // Default longitude
      locationName: null,
      parentId: userId,
      status: 'ACTIVE'
    }
  });

  // Process and save images
  const imagePromises = req.files.map(async (file, index) => {
    // Create case image record
    const caseImage = await prisma.caseImage.create({
      data: {
        parentReportId: parentReport.id,
        imageUrl: file.url || file.location,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        embeddingVector: [] // Will be updated after processing
      }
    });

    // Process image for matching in background
    try {
      const embeddings = await processImageForMatching(file.path || file.location);
      
      await prisma.caseImage.update({
        where: { id: caseImage.id },
        data: { 
          embeddingVector: embeddings
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
      await findMatches(parentReport.id, 'PARENT');
    } catch (error) {
      console.error('Error finding matches:', error);
    }
  }, 1000);

  // Send notification to admin
  await sendNotification({
    userId: null, // Admin notification
    title: 'New Missing Child Report',
    message: `New report for ${childName} has been submitted`,
    type: 'ADMIN_ALERT',
    data: { reportId: parentReport.id, reportType: 'parent' }
  });

  const result = await prisma.parentReport.findUnique({
    where: { id: parentReport.id },
    include: {
      images: {
        select: {
          id: true,
          imageUrl: true,
          fileName: true,
          fileSize: true,
          mimeType: true
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
  });

  res.status(201).json({
    success: true,
    message: 'Parent report created successfully',
    data: { report: result }
  });
});

// Get all parent reports
const getParentReports = asyncHandler(async (req, res) => {
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
      { additionalDetails: { contains: search, mode: 'insensitive' } },
      { placeLost: { contains: search, mode: 'insensitive' } }
    ];
  }

  const orderBy = {};
  orderBy[sortBy] = sortOrder.toLowerCase();

  const [reports, total] = await Promise.all([
    prisma.parentReport.findMany({
      where,
      include: {
        images: {
          select: {
            id: true,
            imageUrl: true,
          }
        },
        parent: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: false
          }
        },
        _count: {
          select: {
            matchesAsParent: true
          }
        }
      },
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy
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

// Get parent report by ID
const getParentReportById = asyncHandler(async (req, res) => {
  const { reportId } = req.params;

  const report = await prisma.parentReport.findUnique({
    where: { id: reportId },
    include: {
      images: {
        select: {
          id: true,
          imageUrl: true,
        }
      },
      parent: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: false,
        }
      },
      matchesAsParent: {
        include: {
          finderCase: {
            select: {
              id: true,
              childName: true,
              placeFound: true,
              foundTime: true,
              additionalDetails: true,
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
      message: 'Parent report not found'
    });
  }

  res.json({
    success: true,
    data: { report }
  });
});

// Update parent report
const updateParentReport = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const userId = req.user.userId;
  const userRole = req.user.role;
  
  const {
    childName,
    fatherName,
    placeLost,
    gender,
    lostTime,
    additionalDetails,
    contactNumber,
    emergency,
    status
  } = req.body;

  // Check if report exists
  const existingReport = await prisma.parentReport.findUnique({
    where: { id: reportId }
  });

  if (!existingReport) {
    return res.status(404).json({
      success: false,
      message: 'Parent report not found'
    });
  }

  // Check permissions
  if (userRole !== 'ADMIN' && existingReport.parentId !== userId) {
    return res.status(403).json({
      success: false,
      message: 'You can only update your own reports'
    });
  }

  const updateData = {};
  
  
  if (childName !== undefined) updateData.childName = childName;
  if (fatherName !== undefined) updateData.fatherName = fatherName;
  if (placeLost !== undefined) updateData.placeLost = placeLost;
  if (gender !== undefined) updateData.gender = gender.toUpperCase();
  if (lostTime !== undefined) updateData.lostTime = new Date(lostTime);
  if (additionalDetails !== undefined) updateData.additionalDetails = additionalDetails;
  if (contactNumber !== undefined) updateData.contactNumber = contactNumber;
  if (emergency !== undefined) updateData.emergency = emergency;
  
  console.log('Update data object:', updateData);
  
  // Only admin can update status
  if (status !== undefined && userRole === 'ADMIN') {
    updateData.status = status.toUpperCase();
  }

  const updatedReport = await prisma.parentReport.update({
    where: { id: reportId },
    data: updateData,
    include: {
      images: {
        select: {
          id: true,
          imageUrl: true,
        }
      },
      parent: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: false
        }
      }
    }
  });

  // Send notification if status changed
  if (status && userRole === 'ADMIN') {
    await sendNotification({
      userId: existingReport.parentId,
      title: 'Report Status Updated',
      message: `Your report for ${existingReport.childName} has been updated to ${status}`,
      type: 'CASE_UPDATE',
      data: { reportId, reportType: 'parent', newStatus: status }
    });
  }

  res.json({
    success: true,
    message: 'Parent report updated successfully',
    data: { report: updatedReport }
  });
});

// Delete parent report
const deleteParentReport = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const userId = req.user.userId;
  const userRole = req.user.role;

  const report = await prisma.parentReport.findUnique({
    where: { id: reportId },
    include: {
      images: true
    }
  });

  if (!report) {
    return res.status(404).json({
      success: false,
      message: 'Parent report not found'
    });
  }

  // Check permissions
  if (userRole !== 'ADMIN' && report.parentId !== userId) {
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
    } catch (error) {
      console.error('Error deleting image from local storage:', error);
    }
  }

  // Delete report (cascade will handle related records)
  await prisma.parentReport.delete({
    where: { id: reportId }
  });

  res.json({
    success: true,
    message: 'Parent report deleted successfully'
  });
});

// Get user's own parent reports
const getMyParentReports = asyncHandler(async (req, res) => {
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
          },
          take: 1
        },
        _count: {
          select: {
            matchesAsParent: true
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

module.exports = {
  createParentReport,
  getParentReports,
  getParentReportById,
  updateParentReport,
  deleteParentReport,
  getMyParentReports
};

