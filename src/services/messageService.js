const Message = require('../models/Message');
const Channel = require('../models/Channel');
const ChannelMember = require('../models/ChannelMember');

/**
 * Send a message to a channel
 * @param {Object} messageData - Message data
 * @param {string} messageData.channelId - Channel ID
 * @param {string} messageData.userId - User ID
 * @param {string} messageData.content - Message content
 * @param {string} messageData.replyTo - Reply message ID
 * @param {string} messageData.messageType - Type of message
 * @returns {Object} Created message data
 */
const sendMessage = async (messageData) => {
  const { channelId, userId, content, replyTo, messageType = 'text' } = messageData;

  // Verify channel exists
  const channel = await Channel.findById(channelId);
  if (!channel) {
    throw new Error('Channel not found');
  }

  // Check if user is member (for private channels)
  if (channel.is_private && !(await ChannelMember.isMember(channelId, userId))) {
    throw new Error('Access denied. You are not a member of this channel.');
  }

  // Validate reply message if provided
  if (replyTo) {
    const replyMessage = await Message.findById(replyTo);
    if (!replyMessage || replyMessage.channel_id.toString() !== channelId) {
      throw new Error('Invalid reply message');
    }
  }

  // Create new message
  const message = new Message({
    channel_id: channelId,
    user_id: userId,
    content,
    reply_to: replyTo,
    message_type: messageType
  });

  await message.save();
  await message.populate('user_id', 'username avatar');
  
  if (replyTo) {
    await message.populate('reply_to', 'content user_id');
  }

  return message;
};

/**
 * Get channel messages
 * @param {string} channelId - Channel ID
 * @param {Object} options - Query options
 * @returns {Object} Messages and pagination info
 */
const getChannelMessages = async (channelId, options) => {
  const { page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;

  // Verify channel exists
  const channel = await Channel.findById(channelId);
  if (!channel) {
    throw new Error('Channel not found');
  }

  // Check if user is member (for private channels)
  if (channel.is_private && !(await ChannelMember.isMember(channelId, options.userId))) {
    throw new Error('Access denied. You are not a member of this channel.');
  }

  const messages = await Message.find({
    channel_id: channelId,
    is_deleted: false
  })
  .sort({ created_at: -1 })
  .skip(skip)
  .limit(parseInt(limit))
  .populate('user_id', 'username avatar')
  .populate('reply_to', 'content user_id');

  const total = await Message.countDocuments({
    channel_id: channelId,
    is_deleted: false
  });

  return {
    messages: messages.map(msg => msg.getPublicInfo()),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get message by ID
 * @param {string} messageId - Message ID
 * @param {string} userId - User ID requesting the message
 * @returns {Object} Message data
 */
const getMessageById = async (messageId, userId) => {
  const message = await Message.findById(messageId)
    .populate('channel_id', 'name is_private')
    .populate('user_id', 'username avatar');

  if (!message) {
    throw new Error('Message not found');
  }

  // Check if user has access to the channel
  const channel = await Channel.findById(message.channel_id);
  if (channel.is_private && !(await ChannelMember.isMember(message.channel_id, userId))) {
    throw new Error('Access denied. You are not a member of this channel.');
  }

  return message;
};

/**
 * Update message
 * @param {string} messageId - Message ID
 * @param {Object} updateData - Data to update
 * @param {string} userId - User ID performing the update
 * @returns {Object} Updated message data
 */
const updateMessage = async (messageId, updateData, userId) => {
  const { content } = updateData;
  
  const message = await Message.findById(messageId);
  if (!message) {
    throw new Error('Message not found');
  }

  // Check if user is the author
  if (message.user_id.toString() !== userId) {
    throw new Error('You can only edit your own messages');
  }

  // Check if message is too old (e.g., 5 minutes)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  if (message.created_at < fiveMinutesAgo) {
    throw new Error('Messages can only be edited within 5 minutes of posting');
  }

  message.content = content;
  message.updated_at = new Date();
  await message.save();

  return message;
};

/**
 * Delete message
 * @param {string} messageId - Message ID
 * @param {string} userId - User ID performing the deletion
 * @returns {boolean} Success status
 */
const deleteMessage = async (messageId, userId) => {
  const message = await Message.findById(messageId)
    .populate('channel_id');

  if (!message) {
    throw new Error('Message not found');
  }

  // Check if user is the author or has moderator role
  const isAuthor = message.user_id.toString() === userId;
  const isModerator = false; // This should come from user context
  const hasChannelModeratorRole = message.channel_id && 
    await ChannelMember.hasRole(message.channel_id._id, userId, 'moderator');

  if (!isAuthor && !isModerator && !hasChannelModeratorRole) {
    throw new Error('You can only delete your own messages or need moderator privileges');
  }

  // Soft delete the message
  await message.softDelete(userId);
  return true;
};

/**
 * Flag message as inappropriate
 * @param {string} messageId - Message ID
 * @param {Object} flagData - Flag data
 * @param {string} flagData.reason - Reason for flagging
 * @param {string} userId - User ID flagging the message
 * @returns {Object} Flagged message data
 */
const flagMessage = async (messageId, flagData, userId) => {
  const { reason } = flagData;
  
  const message = await Message.findById(messageId);
  if (!message) {
    throw new Error('Message not found');
  }

  if (message.is_flagged) {
    throw new Error('Message is already flagged');
  }

  await message.flag(reason, userId);
  return message;
};

/**
 * Unflag message
 * @param {string} messageId - Message ID
 * @returns {Object} Unflagged message data
 */
const unflagMessage = async (messageId) => {
  const message = await Message.findById(messageId);
  if (!message) {
    throw new Error('Message not found');
  }

  if (!message.is_flagged) {
    throw new Error('Message is not flagged');
  }

  await message.unflag();
  return message;
};

/**
 * Get flagged messages
 * @param {Object} options - Query options
 * @returns {Object} Flagged messages and pagination info
 */
const getFlaggedMessages = async (options) => {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  const messages = await Message.getFlaggedMessages(page, limit);
  const total = await Message.countDocuments({ is_flagged: true, is_deleted: false });

  return {
    messages,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Search messages in a channel
 * @param {string} channelId - Channel ID
 * @param {Object} options - Search options
 * @returns {Object} Search results and pagination info
 */
const searchMessages = async (channelId, options) => {
  const { query, page = 1, limit = 50, userId } = options;

  if (!query) {
    throw new Error('Search query is required');
  }

  // Check if channel exists and user has access
  const channel = await Channel.findById(channelId);
  if (!channel) {
    throw new Error('Channel not found');
  }

  if (channel.is_private && !(await ChannelMember.isMember(channelId, userId))) {
    throw new Error('Access denied. You are not a member of this channel.');
  }

  const skip = (page - 1) * limit;

  const messages = await Message.find({
    channel_id: channelId,
    content: { $regex: query, $options: 'i' },
    is_deleted: false
  })
  .sort({ created_at: -1 })
  .skip(skip)
  .limit(parseInt(limit))
  .populate('user_id', 'username avatar')
  .populate('reply_to', 'content user_id');

  const total = await Message.countDocuments({
    channel_id: channelId,
    content: { $regex: query, $options: 'i' },
    is_deleted: false
  });

  return {
    messages: messages.map(msg => msg.getPublicInfo()),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Restore deleted message
 * @param {string} messageId - Message ID
 * @param {string} userId - User ID performing the restoration
 * @returns {Object} Restored message data
 */
const restoreMessage = async (messageId, userId) => {
  const message = await Message.findById(messageId);
  if (!message) {
    throw new Error('Message not found');
  }

  if (!message.is_deleted) {
    throw new Error('Message is not deleted');
  }

  await message.restore();
  return message;
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
  searchMessages,
  restoreMessage
};
