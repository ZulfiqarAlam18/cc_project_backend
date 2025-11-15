const express = require('express');
const {
  getMatches,
  getMatchById,
  updateMatchStatus,
  getUserMatches,
  deleteMatch,
  getMatchStats
} = require('../controllers/matchController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

// @route   GET /api/matches
// @desc    Get all matches (Admin only)
// @access  Private/Admin
router.get('/', authenticateToken, authorizeRoles('ADMIN'), getMatches);

// @route   GET /api/matches/my
// @desc    Get current user's matches
// @access  Private
router.get('/my', authenticateToken, getUserMatches);

// @route   GET /api/matches/stats
// @desc    Get match statistics (Admin only)
// @access  Private/Admin
router.get('/stats', authenticateToken, authorizeRoles('ADMIN'), getMatchStats);

// @route   GET /api/matches/:matchId
// @desc    Get match by ID
// @access  Private
router.get('/:matchId', authenticateToken, getMatchById);

// @route   PUT /api/matches/:matchId/status
// @desc    Update match status (Admin only)
// @access  Private/Admin
router.put(
  '/:matchId/status',
  authenticateToken,
  authorizeRoles('ADMIN'),
  updateMatchStatus
);

// @route   DELETE /api/matches/:matchId
// @desc    Delete match (Admin only)
// @access  Private/Admin
router.delete('/:matchId', authenticateToken, authorizeRoles('ADMIN'), deleteMatch);

module.exports = router;
