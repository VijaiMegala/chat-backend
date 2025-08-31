const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Register a new user
 * @param {Object} userData - User registration data
 * @param {string} userData.username - Username
 * @param {string} userData.email - Email address
 * @param {string} userData.password - Password
 * @returns {Object} Registration result with token and user data
 */
const registerUser = async (username, email, password) => {

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ email }, { username }]
  });

  if (existingUser) {
    throw new Error(existingUser.email === email 
      ? 'Email already registered' 
      : 'Username already taken'
    );
  }

  // Create new user
  const user = new User({
    username,
    email,
    password
  });

  await user.save();

  // Generate JWT token
  const token = jwt.sign(
    { userId: user._id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  return {
    token,
    user: user.getPublicProfile()
  };
};

/**
 * Authenticate user login
 * @param {Object} credentials - User credentials
 * @param {string} credentials.email - Email address
 * @param {string} credentials.password - Password
 * @returns {Object} Login result with token and user data
 */
const loginUser = async (email, password) => {

  // Find user by email
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error('Invalid email or password');
  }

  // Check if user is banned
  if (user.isBanned()) {
    throw new Error('Account is banned. Please contact support.');
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new Error('Invalid email or password');
  }

  // Update last seen
  user.last_seen = new Date();
  await user.save();

  // Generate JWT token
  const token = jwt.sign(
    { userId: user._id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  return {
    token,
    user: user.getPublicProfile()
  };
};

/**
 * Refresh JWT token
 * @param {string} token - Current JWT token
 * @returns {Object} New token and user data
 */
const refreshToken = async (token) => {
  if (!token) {
    throw new Error('Token is required');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      throw new Error('Invalid token');
    }

    if (user.isBanned()) {
      throw new Error('Account is banned');
    }

    // Generate new token
    const newToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return {
      token: newToken,
      user: user.getPublicProfile()
    };
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      throw new Error('Invalid or expired token');
    }
    throw error;
  }
};

/**
 * Verify JWT token and get user
 * @param {string} token - JWT token
 * @returns {Object} User data
 */
const verifyToken = async (token) => {
  if (!token) {
    throw new Error('Access denied. No token provided.');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      throw new Error('Invalid token. User not found.');
    }

    if (user.isBanned()) {
      throw new Error('Account is banned. Please contact support.');
    }

    return user;
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token.');
    }
    
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expired.');
    }
    
    throw error;
  }
};

module.exports = {
  registerUser,
  loginUser,
  refreshToken,
  verifyToken
};
