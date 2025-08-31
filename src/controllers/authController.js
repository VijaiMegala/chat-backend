const authService = require('../services/authService');

/**
 * Register a new user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    const result = await authService.registerUser({ username, email, password });
    
    res.status(201).json({
      message: 'User registered successfully',
      token: result.token,
      user: result.user
    });
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
};

/**
 * User login
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const result = await authService.loginUser({ email, password });
    
    res.json({
      message: 'Login successful',
      token: result.token,
      user: result.user
    });
  } catch (error) {
    if (error.message === 'Invalid email or password') {
      res.status(401).json({
        error: error.message
      });
    } else if (error.message.includes('banned')) {
      res.status(403).json({
        error: error.message
      });
    } else {
      res.status(400).json({
        error: error.message
      });
    }
  }
};

/**
 * Refresh JWT token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const refreshToken = async (req, res) => {
  try {
    const { token } = req.body;
    
    const result = await authService.refreshToken(token);
    
    res.json({
      message: 'Token refreshed successfully',
      token: result.token,
      user: result.user
    });
  } catch (error) {
    if (error.message.includes('Invalid or expired token')) {
      res.status(401).json({
        error: error.message
      });
    } else {
      res.status(400).json({
        error: error.message
      });
    }
  }
};

/**
 * User logout (client-side token removal)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const logout = async (req, res) => {
  res.json({
    message: 'Logout successful'
  });
};

module.exports = {
  register,
  login,
  refreshToken,
  logout
};
