const bcrypt = require('bcrypt');
const { prisma } = require('../config/db');
// const { deleteFromS3 } = require('../config/awsS3'); // Commented out for local storage
const { asyncHandler } = require('../middleware/errorHandler');
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

// Get user profile
const getProfile = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

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

  res.json({
    success: true,
    data: { user }
  });
});

// Update user profile
const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { name, phone } = req.body;

  // Check if phone is already taken by another user
  if (phone) {
    const existingUser = await prisma.user.findFirst({
      where: {
        phone,
        id: { not: userId }
      }
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Phone number is already in use'
      });
    }
  }

  const updateData = {};
  if (name) updateData.name = name;
  if (phone) updateData.phone = phone;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      profileImage: true,
      isVerified: true,
      updatedAt: true
    }
  });

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: { user: updatedUser }
  });
});

// Upload profile image
const uploadProfileImage = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No image file provided'
    });
  }

  // Get current user to delete old profile image
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { profileImage: true }
  });

  // Update user with new profile image URL
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { profileImage: req.file.location },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      profileImage: true,
      isVerified: true,
      updatedAt: true
    }
  });

  // Delete old profile image from local storage if exists
  if (currentUser.profileImage) {
    try {
      // Extract local file path from URL
      const oldFilePath = currentUser.profileImage.replace(`${req.protocol}://${req.get('host')}`, '');
      const fullPath = path.join(__dirname, '../../', oldFilePath);
      await deleteLocalFile(fullPath);
      // await deleteFromS3(currentUser.profileImage); // AWS S3 deletion - commented out
    } catch (error) {
      console.error('Error deleting old profile image:', error);
    }
  }

  res.json({
    success: true,
    message: 'Profile image uploaded successfully',
    data: { user: updatedUser }
  });
});

// Change password
const changePassword = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { currentPassword, newPassword } = req.body;

  // Get user with password
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true }
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Verify current password
  const isValidPassword = await bcrypt.compare(currentPassword, user.password);
  if (!isValidPassword) {
    return res.status(400).json({
      success: false,
      message: 'Current password is incorrect'
    });
  }

  // Hash new password
  const saltRounds = 12;
  const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

  // Update password
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedNewPassword }
  });

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
});

// Delete account
const deleteAccount = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { password } = req.body;

  // Get user with password
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true, profileImage: true }
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    return res.status(400).json({
      success: false,
      message: 'Password is incorrect'
    });
  }

  // Delete profile image from local storage if exists
  if (user.profileImage) {
    try {
      // Extract local file path from URL
      const oldFilePath = user.profileImage.replace(`${req.protocol}://${req.get('host')}`, '');
      const fullPath = path.join(__dirname, '../../', oldFilePath);
      await deleteLocalFile(fullPath);
      // await deleteFromS3(user.profileImage); // AWS S3 deletion - commented out
    } catch (error) {
      console.error('Error deleting profile image:', error);
    }
  }

  // Soft delete user (deactivate account)
  await prisma.user.update({
    where: { id: userId },
    data: { 
      isActive: false,
      email: `deleted_${Date.now()}_${user.email}`, // Prevent email conflicts
      phone: `deleted_${Date.now()}_${user.phone}` // Prevent phone conflicts
    }
  });

  res.json({
    success: true,
    message: 'Account deleted successfully'
  });
});

// Admin: Get all users
const getAllUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, role, search } = req.query;
  const skip = (page - 1) * limit;

  const where = {
    isActive: true
  };

  if (role) {
    where.role = role.toUpperCase();
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } }
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        profileImage: true,
        isVerified: true,
        isActive: true,
        lastLogin: true,
        createdAt: true
      },
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' }
    }),
    prisma.user.count({ where })
  ]);

  res.json({
    success: true,
    data: {
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// Admin: Get user by ID
const getUserById = asyncHandler(async (req, res) => {
  const { userId } = req.params;

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
      isActive: true,
      lastLogin: true,
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
  const [parentReportsCount, finderReportsCount] = await Promise.all([
    prisma.parentReport.count({ where: { parentId: userId } }),
    prisma.finderReport.count({ where: { finderId: userId } })
  ]);

  // Combine the data
  const userData = {
    ...user,
    _count: {
      parentReports: parentReportsCount,
      finderReports: finderReportsCount
    }
  };

  res.json({
    success: true,
    data: { user: userData }
  });
});

// Admin: Update user
const updateUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { name, email, phone, role, isVerified, isActive } = req.body;

  // Check if email is already taken by another user
  if (email) {
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
        id: { not: userId }
      }
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email is already in use'
      });
    }
  }

  // Check if phone is already taken by another user
  if (phone) {
    const existingUser = await prisma.user.findFirst({
      where: {
        phone,
        id: { not: userId }
      }
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Phone number is already in use'
      });
    }
  }

  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (email !== undefined) updateData.email = email;
  if (phone !== undefined) updateData.phone = phone;
  if (role !== undefined) updateData.role = role.toUpperCase();
  if (isVerified !== undefined) updateData.isVerified = isVerified;
  if (isActive !== undefined) updateData.isActive = isActive;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      profileImage: true,
      isVerified: true,
      isActive: true,
      updatedAt: true
    }
  });

  res.json({
    success: true,
    message: 'User updated successfully',
    data: { user: updatedUser }
  });
});

module.exports = {
  getProfile,
  updateProfile,
  uploadProfileImage,
  changePassword,
  deleteAccount,
  getAllUsers,
  getUserById,
  updateUser
};
