const userService = require('../services/userService');

/**
 * Get current user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getProfile = async (req, res) => {
  try {
    const user = await userService.getUserById(req.user.id);
    
    res.json({
      user: user.getPublicProfile()
    });
  } catch (error) {
    res.status(404).json({
      error: error.message
    });
  }
};

/**
 * Update current user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateProfile = async (req, res) => {
  try {
    const { username, email, avatar } = req.body;
    const updateData = {};

    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (avatar) updateData.avatar = avatar;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: 'No valid fields to update'
      });
    }

    const updatedUser = await userService.updateUserProfile(req.user.id, updateData);
    
    res.json({
      message: 'Profile updated successfully',
      user: updatedUser.getPublicProfile()
    });
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
};

/**
 * Change user password
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    await userService.changePassword(req.user.id, currentPassword, newPassword);
    
    res.json({
      message: 'Password changed successfully'
    });
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
};

/**
 * Get all users (admin/moderator only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAllUsers = async (req, res) => {
  try {
    const { page, limit, search, role } = req.query;
    
    const result = await userService.getAllUsers({ page, limit, search, role });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

/**
 * Get user by ID (admin/moderator only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserById = async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.id);
    
    res.json({
      user: user.getPublicProfile()
    });
  } catch (error) {
    res.status(404).json({
      error: error.message
    });
  }
};

/**
 * Ban user (admin/moderator only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const banUser = async (req, res) => {
  try {
    const { bannedUntil } = req.body;
    
    const bannedUser = await userService.banUser(req.params.id, bannedUntil, req.user.id);
    
    res.json({
      message: 'User banned successfully',
      user: bannedUser.getPublicProfile()
    });
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
};

/**
 * Unban user (admin/moderator only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const unbanUser = async (req, res) => {
  try {
    const unbannedUser = await userService.unbanUser(req.params.id);
    
    res.json({
      message: 'User unbanned successfully',
      user: unbannedUser.getPublicProfile()
    });
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
};

/**
 * Change user role (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const changeUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    
    const updatedUser = await userService.changeUserRole(req.params.id, role);
    
    res.json({
      message: 'User role changed successfully',
      user: updatedUser.getPublicProfile()
    });
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
};

/**
 * Delete user (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteUser = async (req, res) => {
  try {
    await userService.deleteUser(req.params.id);
    
    res.json({
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  getAllUsers,
  getUserById,
  banUser,
  unbanUser,
  changeUserRole,
  deleteUser
};
