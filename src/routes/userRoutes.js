const express = require('express');
const {
  getProfile,
  updateProfile,
  uploadProfileImage,
  changePassword,
  deleteAccount,
  getAllUsers,
  getUserById,
  updateUser
} = require('../controllers/userController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const { uploadSingle } = require('../middleware/uploadMiddleware');
const {
  updateProfileValidation,
  changePasswordValidation,
  deleteAccountValidation,
  updateUserValidation
} = require('../middleware/validateMiddleware');

const router = express.Router();

// @route   GET /api/users/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', authenticateToken, getProfile);

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authenticateToken, updateProfileValidation, updateProfile);

// @route   POST /api/users/profile/image
// @desc    Upload profile image
// @access  Private
router.post('/profile/image', authenticateToken, uploadSingle('profileImage'), uploadProfileImage);

// @route   PUT /api/users/password
// @desc    Change password
// @access  Private
router.put('/password', authenticateToken, changePassword);

// @route   DELETE /api/users/account
// @desc    Delete user account
// @access  Private
router.delete('/account', authenticateToken, deleteAccountValidation, deleteAccount);

// Admin routes
// @route   GET /api/users
// @desc    Get all users (Admin only)
// @access  Private/Admin
router.get('/', authenticateToken, authorizeRoles('ADMIN'), getAllUsers);

// @route   GET /api/users/:userId
// @desc    Get user by ID (Admin only)
// @access  Private/Admin
router.get('/:userId', authenticateToken, authorizeRoles('ADMIN'), getUserById);

// @route   PUT /api/users/:userId
// @desc    Update user by ID (Admin only)
// @access  Private/Admin
router.put('/:userId', authenticateToken, authorizeRoles('ADMIN'), updateUserValidation, updateUser);

module.exports = router;
