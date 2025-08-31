const User = require('../models/User');

/**
 * Get user by ID
 * @param {string} userId - User ID
 * @param {boolean} includePassword - Whether to include password field
 * @returns {Object} User data
 */
const getUserById = async (userId, includePassword = false) => {
  const user = includePassword 
    ? await User.findById(userId)
    : await User.findById(userId).select('-password');
  
  if (!user) {
    throw new Error('User not found');
  }
  
  return user;
};

/**
 * Get user by email
 * @param {string} email - User email
 * @returns {Object} User data
 */
const getUserByEmail = async (email) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error('User not found');
  }
  return user;
};

/**
 * Get user by username
 * @param {string} username - Username
 * @returns {Object} User data
 */
const getUserByUsername = async (username) => {
  const user = await User.findOne({ username });
  if (!user) {
    throw new Error('User not found');
  }
  return user;
};

/**
 * Get all users with pagination and filtering
 * @param {Object} options - Query options
 * @param {number} options.page - Page number
 * @param {number} options.limit - Items per page
 * @param {string} options.search - Search term
 * @param {string} options.role - Role filter
 * @returns {Object} Users and pagination info
 */
const getAllUsers = async (options) => {
  const { page = 1, limit = 50, search, role } = options;
  const skip = (page - 1) * limit;

  const query = { is_deleted: { $ne: true } };

  if (search) {
    query.$or = [
      { username: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  if (role) {
    query.role = role;
  }

  const users = await User.find(query)
    .select('-password')
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await User.countDocuments(query);

  return {
    users: users.map(user => user.getPublicProfile()),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Update user profile
 * @param {string} userId - User ID
 * @param {Object} updateData - Data to update
 * @returns {Object} Updated user data
 */
const updateUserProfile = async (userId, updateData) => {
  const user = await getUserById(userId);
  
  // Check if username is being changed and if it's already taken
  if (updateData.username && updateData.username !== user.username) {
    const existingUser = await getUserByUsername(updateData.username);
    if (existingUser) {
      throw new Error('Username already taken');
    }
  }

  // Check if email is being changed and if it's already taken
  if (updateData.email && updateData.email !== user.email) {
    const existingUser = await getUserByEmail(updateData.email);
    if (existingUser) {
      throw new Error('Email already registered');
    }
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    updateData,
    { new: true, runValidators: true }
  ).select('-password');

  return updatedUser;
};

/**
 * Change user password
 * @param {string} userId - User ID
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 * @returns {boolean} Success status
 */
const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await getUserById(userId, true);
  
  const isCurrentPasswordValid = await user.comparePassword(currentPassword);
  if (!isCurrentPasswordValid) {
    throw new Error('Current password is incorrect');
  }

  user.password = newPassword;
  await user.save();
  
  return true;
};

/**
 * Ban user
 * @param {string} userId - User ID to ban
 * @param {Date} bannedUntil - Ban expiration date
 * @param {string} bannedBy - User ID who performed the ban
 * @returns {Object} Updated user data
 */
const banUser = async (userId, bannedUntil, bannedBy) => {
  if (!bannedUntil) {
    throw new Error('Ban duration is required');
  }

  const user = await getUserById(userId);
  
  // Only admins can ban moderators
  if (user.role === 'moderator' && bannedBy) {
    const adminUser = await getUserById(bannedBy);
    if (adminUser.role !== 'admin') {
      throw new Error('Only admins can ban moderators');
    }
  }

  user.banned_until = new Date(bannedUntil);
  await user.save();
  
  return user;
};

/**
 * Unban user
 * @param {string} userId - User ID to unban
 * @returns {Object} Updated user data
 */
const unbanUser = async (userId) => {
  const user = await getUserById(userId);
  
  user.banned_until = undefined;
  await user.save();
  
  return user;
};

/**
 * Change user role
 * @param {string} userId - User ID
 * @param {string} newRole - New role
 * @returns {Object} Updated user data
 */
const changeUserRole = async (userId, newRole) => {
  if (!['user', 'moderator', 'admin'].includes(newRole)) {
    throw new Error('Invalid role');
  }

  const user = await getUserById(userId);
  user.role = newRole;
  await user.save();
  
  return user;
};

/**
 * Delete user
 * @param {string} userId - User ID to delete
 * @returns {boolean} Success status
 */
const deleteUser = async (userId) => {
  const user = await getUserById(userId);
  await User.findByIdAndDelete(userId);
  return true;
};

/**
 * Update user online status
 * @param {string} userId - User ID
 * @param {boolean} isOnline - Online status
 * @returns {Object} Updated user data
 */
const updateOnlineStatus = async (userId, isOnline) => {
  const user = await getUserById(userId);
  user.is_online = isOnline;
  user.last_seen = new Date();
  await user.save();
  return user;
};

/**
 * Check if user exists by email or username
 * @param {string} email - Email to check
 * @param {string} username - Username to check
 * @returns {Object|null} Existing user or null
 */
const checkUserExists = async (email, username) => {
  return await User.findOne({
    $or: [{ email }, { username }]
  });
};

module.exports = {
  getUserById,
  getUserByEmail,
  getUserByUsername,
  getAllUsers,
  updateUserProfile,
  changePassword,
  banUser,
  unbanUser,
  changeUserRole,
  deleteUser,
  updateOnlineStatus,
  checkUserExists
};
