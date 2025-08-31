const messageService = require('../services/messageService');

/**
 * Send a message to a channel
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const sendMessage = async (req, res) => {
  try {
    const { content, reply_to, message_type } = req.body;
    const channelId = req.params.id;
    
    const message = await messageService.sendMessage({
      channelId,
      userId: req.user.id,
      content,
      replyTo: reply_to,
      messageType: message_type
    });
    
    res.status(201).json({
      message: 'Message sent successfully',
      data: message.getPublicInfo()
    });
  } catch (error) {
    if (error.message === 'Channel not found') {
      res.status(404).json({
        error: error.message
      });
    } else if (error.message.includes('Access denied')) {
      res.status(403).json({
        error: error.message
      });
    } else if (error.message.includes('Invalid reply message')) {
      res.status(400).json({
        error: error.message
      });
    } else {
      res.status(500).json({
        error: error.message
      });
    }
  }
};

/**
 * Get channel message history
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getChannelMessages = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const channelId = req.params.id;
    
    const result = await messageService.getChannelMessages(channelId, { 
      page, 
      limit, 
      userId: req.user.id 
    });
    
    res.json(result);
  } catch (error) {
    if (error.message === 'Channel not found') {
      res.status(404).json({
        error: error.message
      });
    } else if (error.message.includes('Access denied')) {
      res.status(403).json({
        error: error.message
      });
    } else {
      res.status(500).json({
        error: error.message
      });
    }
  }
};

/**
 * Get message by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getMessageById = async (req, res) => {
  try {
    const message = await messageService.getMessageById(req.params.id, req.user.id);
    
    res.json({
      message: message.getPublicInfo()
    });
  } catch (error) {
    if (error.message === 'Message not found') {
      res.status(404).json({
        error: error.message
      });
    } else if (error.message.includes('Access denied')) {
      res.status(403).json({
        error: error.message
      });
    } else {
      res.status(500).json({
        error: error.message
      });
    }
  }
};

/**
 * Update message
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateMessage = async (req, res) => {
  try {
    const { content } = req.body;
    
    const message = await messageService.updateMessage(req.params.id, { content }, req.user.id);
    
    res.json({
      message: 'Message updated successfully',
      data: message.getPublicInfo()
    });
  } catch (error) {
    if (error.message === 'Message not found') {
      res.status(404).json({
        error: error.message
      });
    } else if (error.message.includes('You can only edit your own messages')) {
      res.status(403).json({
        error: error.message
      });
    } else if (error.message.includes('Messages can only be edited within')) {
      res.status(400).json({
        error: error.message
      });
    } else {
      res.status(500).json({
        error: error.message
      });
    }
  }
};

/**
 * Delete message
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteMessage = async (req, res) => {
  try {
    await messageService.deleteMessage(req.params.id, req.user.id);
    
    res.json({
      message: 'Message deleted successfully'
    });
  } catch (error) {
    if (error.message === 'Message not found') {
      res.status(404).json({
        error: error.message
      });
    } else if (error.message.includes('You can only delete your own messages')) {
      res.status(403).json({
        error: error.message
      });
    } else {
      res.status(500).json({
        error: error.message
      });
    }
  }
};

/**
 * Flag message as inappropriate
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const flagMessage = async (req, res) => {
  try {
    const { reason } = req.body;
    
    const message = await messageService.flagMessage(req.params.id, { reason }, req.user.id);
    
    res.json({
      message: 'Message flagged successfully',
      data: message.getPublicInfo()
    });
  } catch (error) {
    if (error.message === 'Message not found') {
      res.status(404).json({
        error: error.message
      });
    } else if (error.message.includes('Message is already flagged')) {
      res.status(400).json({
        error: error.message
      });
    } else {
      res.status(500).json({
        error: error.message
      });
    }
  }
};

/**
 * Unflag message
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const unflagMessage = async (req, res) => {
  try {
    const message = await messageService.unflagMessage(req.params.id);
    
    res.json({
      message: 'Message unflagged successfully'
    });
  } catch (error) {
    if (error.message === 'Message not found') {
      res.status(404).json({
        error: error.message
      });
    } else if (error.message.includes('Message is not flagged')) {
      res.status(400).json({
        error: error.message
      });
    } else {
      res.status(500).json({
        error: error.message
      });
    }
  }
};

/**
 * Get flagged messages (moderator only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getFlaggedMessages = async (req, res) => {
  try {
    const { page, limit } = req.query;
    
    const result = await messageService.getFlaggedMessages({ page, limit });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

/**
 * Search messages in a channel
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const searchMessages = async (req, res) => {
  try {
    const { q: query, page, limit } = req.query;
    const channelId = req.params.channelId;
    
    if (!query) {
      return res.status(400).json({
        error: 'Search query is required'
      });
    }
    
    const result = await messageService.searchMessages(channelId, { 
      query, 
      page, 
      limit, 
      userId: req.user.id 
    });
    
    res.json(result);
  } catch (error) {
    if (error.message === 'Channel not found') {
      res.status(404).json({
        error: error.message
      });
    } else if (error.message.includes('Access denied')) {
      res.status(403).json({
        error: error.message
      });
    } else if (error.message === 'Search query is required') {
      res.status(400).json({
        error: error.message
      });
    } else {
      res.status(500).json({
        error: error.message
      });
    }
  }
};

module.exports = {
  sendMessage,
  getChannelMessages,
  getMessageById,
  updateMessage,
  deleteMessage,
  flagMessage,
  unflagMessage,
  getFlaggedMessages,
  searchMessages
};
