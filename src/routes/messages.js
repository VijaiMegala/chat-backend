const express = require('express');
const { validateMessage, validatePagination } = require('../middleware/validation');
const { messageRateLimiter } = require('../middleware/rateLimiter');
const { contentModeration } = require('../middleware/contentModeration');
const { requireModerator } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const messageController = require('../controllers/messageController');
const Message = require('../models/Message');
const Channel = require('../models/Channel');
const ChannelMember = require('../models/ChannelMember');

const router = express.Router();

/**
 * @swagger
 * /api/messages/channel/{id}:
 *   get:
 *     summary: Get channel message history
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Channel ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Number of messages per page
 *     responses:
 *       200:
 *         description: Channel messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messages:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/Message'
 *                       - type: object
 *                         properties:
 *                           user_id:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               username:
 *                                 type: string
 *                               avatar:
 *                                 type: string
 *                           reply_to:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               content:
 *                                 type: string
 *                               user_id:
 *                                 type: string
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Access denied to channel
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Channel not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Too many messages sent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get channel messages
router.get('/channel/:id',
  validatePagination,
  asyncHandler(async (req, res) => {
    const { id: channelId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    // Check if channel exists
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({
        error: 'Channel not found'
      });
    }

    // Check if user has access to the channel
    if (channel.is_private && !(await ChannelMember.isMember(channelId, req.user.id))) {
      return res.status(403).json({
        error: 'Access denied. You are not a member of this channel.'
      });
    }

    // Get messages
    const messages = await Message.find({
      channel_id: channelId,
      is_deleted: false
    })
      .populate('user_id', 'username avatar')
      .populate('reply_to', 'content user_id')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Message.countDocuments({
      channel_id: channelId,
      is_deleted: false
    });

    res.json({
      messages: messages.map(message => message.getPublicInfo()),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  })
);

/**
 * @swagger
 * /api/messages/channel/{id}:
 *   post:
 *     summary: Send message to channel
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Channel ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MessageRequest'
 *     responses:
 *       201:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Message sent successfully
 *                 data:
 *                   $ref: '#/components/schemas/Message'
 *       400:
 *         description: Validation error or invalid reply
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Access denied to channel
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Channel not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Too many messages sent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Send message to channel
router.post('/channel/:id',
  messageRateLimiter,
  validateMessage,
  contentModeration,
  asyncHandler(async (req, res) => {
    const { id: channelId } = req.params;
    const { content, reply_to, message_type = 'text' } = req.body;
    
    // Convert empty string reply_to to null
    const normalizedReplyTo = reply_to === '' ? null : reply_to;

    // Check if channel exists
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({
        error: 'Channel not found'
      });
    }

    // Check if user is member
    if (!(await ChannelMember.isMember(channelId, req.user.id))) {
      return res.status(403).json({
        error: 'Access denied. You are not a member of this channel.'
      });
    }

    // Check if replying to a valid message
    if (normalizedReplyTo) {
      const replyMessage = await Message.findById(normalizedReplyTo);
      if (!replyMessage || replyMessage.channel_id.toString() !== channelId) {
        return res.status(400).json({
          error: 'Invalid reply message'
        });
      }
    }

    // Create new message
    const message = new Message({
      channel_id: channelId,
      user_id: req.user.id,
      content,
      reply_to: normalizedReplyTo,
      message_type,
      metadata: {
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      }
    });

    await message.save();

    // Populate user info
    await message.populate('user_id', 'username avatar');
    if (normalizedReplyTo) {
      await message.populate('reply_to', 'content user_id');
    }

    // Emit to WebSocket for real-time delivery
    if (req.app.get('io')) {
      req.app.get('io').to(channelId).emit('message_received', {
        message: message.getPublicInfo(),
        channelId,
        timestamp: new Date()
      });
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message.getPublicInfo()
    });
  })
);

/**
 * @swagger
 * /api/messages/{id}:
 *   get:
 *     summary: Get message by ID
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Message ID
 *     responses:
 *       200:
 *         description: Message retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   $ref: '#/components/schemas/Message'
 *       403:
 *         description: Access denied to channel
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Message not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get message by ID
router.get('/:id',
  asyncHandler(async (req, res) => {
    const message = await Message.findById(req.params.id)
      .populate('user_id', 'username avatar')
      .populate('channel_id', 'name')
      .populate('reply_to', 'content user_id');

    if (!message) {
      return res.status(404).json({
        error: 'Message not found'
      });
    }

    // Check if user has access to the channel
    const channel = await Channel.findById(message.channel_id);
    if (channel.is_private && !(await ChannelMember.isMember(message.channel_id, req.user.id))) {
      return res.status(403).json({
        error: 'Access denied. You are not a member of this channel.'
      });
    }

    res.json({
      message: message.getPublicInfo()
    });
  })
);

/**
 * @swagger
 * /api/messages/{id}:
 *   put:
 *     summary: Update message (author only)
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Message ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 2000
 *                 description: New message content
 *     responses:
 *       200:
 *         description: Message updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Message updated successfully
 *                 data:
 *                   $ref: '#/components/schemas/Message'
 *       400:
 *         description: Validation error or message too old to edit
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Can only edit own messages
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Message not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Update message (author only)
router.put('/:id',
  validateMessage,
  contentModeration,
  asyncHandler(async (req, res) => {
    const { content } = req.body;
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        error: 'Message not found'
      });
    }

    // Check if user is the author
    if (message.user_id.toString() !== req.user.id) {
      return res.status(403).json({
        error: 'You can only edit your own messages'
      });
    }

    // Check if message is too old (e.g., 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (message.created_at < fiveMinutesAgo) {
      return res.status(400).json({
        error: 'Messages can only be edited within 5 minutes of posting'
      });
    }

    message.content = content;
    message.updated_at = new Date();
    await message.save();

    // Emit to WebSocket for real-time updates
    if (req.app.get('io')) {
      req.app.get('io').to(message.channel_id.toString()).emit('message_updated', {
        message: message.getPublicInfo(),
        channelId: message.channel_id,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Message updated successfully',
      data: message.getPublicInfo()
    });
  })
);

/**
 * @swagger
 * /api/messages/{id}:
 *   delete:
 *     summary: Delete message (author or moderator only)
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Message ID
 *     responses:
 *       200:
 *         description: Message deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       403:
 *         description: Can only delete own messages or insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Message not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Delete message (author or moderator only)
router.delete('/:id',
  asyncHandler(async (req, res) => {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        error: 'Message not found'
      });
    }

    // Check if user can delete the message
    const canDelete = message.user_id.toString() === req.user.id || 
                     req.user.role === 'moderator' || 
                     req.user.role === 'admin';

    if (!canDelete) {
      return res.status(403).json({
        error: 'You can only delete your own messages'
      });
    }

    // Soft delete the message
    message.is_deleted = true;
    message.deleted_by = req.user.id;
    message.deleted_at = new Date();
    await message.save();

    // Emit to WebSocket for real-time updates
    if (req.app.get('io')) {
      req.app.get('io').to(message.channel_id.toString()).emit('message_deleted', {
        messageId: message._id,
        channelId: message.channel_id,
        deletedBy: req.user.id,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  })
);

/**
 * @swagger
 * /api/messages/{id}/flag:
 *   post:
 *     summary: Flag a message for moderation
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Message ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 enum: [inappropriate, spam, harassment, other]
 *                 description: Reason for flagging the message
 *     responses:
 *       200:
 *         description: Message flagged successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid flag reason
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Message not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Flag message for moderation
router.post('/:id/flag',
  asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        error: 'Message not found'
      });
    }

    // Check if message is already flagged
    if (message.is_flagged) {
      return res.status(400).json({
        error: 'Message is already flagged'
      });
    }

    // Flag the message
    await message.flag(reason, req.user.id);

    // Emit to WebSocket for real-time updates
    if (req.app.get('io')) {
      req.app.get('io').to(message.channel_id.toString()).emit('message_flagged', {
        message: message.getPublicInfo(),
        flaggedBy: req.user.id,
        reason,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Message flagged successfully'
    });
  })
);

/**
 * @swagger
 * /api/messages/flagged:
 *   get:
 *     summary: Get flagged messages (moderator only)
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Flagged messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Moderator access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get flagged messages (moderator only)
router.get('/flagged',
  requireModerator,
  validatePagination,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const messages = await Message.find({
      is_flagged: true,
      is_deleted: false
    })
      .populate('user_id', 'username avatar')
      .populate('channel_id', 'name')
      .populate('flagged_by', 'username')
      .sort({ flagged_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Message.countDocuments({
      is_flagged: true,
      is_deleted: false
    });

    res.json({
      messages: messages.map(message => message.getPublicInfo()),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  })
);

module.exports = router;
