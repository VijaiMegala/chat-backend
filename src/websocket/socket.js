const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Channel = require('../models/Channel');
const ChannelMember = require('../models/ChannelMember');
const Message = require('../models/Message');

// Store connected users and their socket mappings
const connectedUsers = new Map(); // userId -> socket
const userChannels = new Map(); // userId -> Set of channelIds
const typingUsers = new Map(); // channelId -> Set of userIds

const setupWebSocket = (io) => {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      if (user.isBanned()) {
        return next(new Error('Authentication error: Account is banned'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`User ${socket.user.username} connected: ${socket.id}`);

    // Update user online status
    await User.findByIdAndUpdate(socket.userId, {
      is_online: true,
      last_seen: new Date()
    });

    // Store socket mapping
    connectedUsers.set(socket.userId, socket);
    userChannels.set(socket.userId, new Set());

    // Join user to their channels
    const userChannelsList = await ChannelMember.find({
      user_id: socket.userId,
      is_active: true
    }).populate('channel_id');

    userChannelsList.forEach(membership => {
      socket.join(membership.channel_id._id.toString());
      userChannels.get(socket.userId).add(membership.channel_id._id.toString());
    });

    // Emit user online status to all connected users
    socket.broadcast.emit('user_online', {
      userId: socket.userId,
      username: socket.user.username,
      timestamp: new Date()
    });

    // Handle joining a channel
    socket.on('join_channel', async (data) => {
      try {
        const { channelId } = data;
        
        // Verify user is member of the channel
        const channel = await Channel.findById(channelId);
        if (!channel || !channel.isMember(socket.userId)) {
          socket.emit('error', { message: 'Access denied to channel' });
          return;
        }

        socket.join(channelId);
        userChannels.get(socket.userId).add(channelId);
        
        socket.emit('channel_joined', { channelId });
        
        // Notify other users in the channel
        socket.to(channelId).emit('user_joined_channel', {
          userId: socket.userId,
          username: socket.user.username,
          channelId,
          timestamp: new Date()
        });
      } catch (error) {
        socket.emit('error', { message: 'Failed to join channel' });
      }
    });

    // Handle leaving a channel
    socket.on('leave_channel', async (data) => {
      try {
        const { channelId } = data;
        
        socket.leave(channelId);
        userChannels.get(socket.userId).delete(channelId);
        
        socket.emit('channel_left', { channelId });
        
        // Notify other users in the channel
        socket.to(channelId).emit('user_left_channel', {
          userId: socket.userId,
          username: socket.user.username,
          channelId,
          timestamp: new Date()
        });
      } catch (error) {
        socket.emit('error', { message: 'Failed to leave channel' });
      }
    });

    // Handle creating a new channel
    socket.on('create_channel', async (data) => {
      try {
        const { name, description, isPrivate, members } = data;
        
        // Check if user has permission to create channels
        const user = await User.findById(socket.userId);
        if (user.role !== 'admin' && user.role !== 'moderator') {
          socket.emit('error', { message: 'Insufficient permissions to create channels' });
          return;
        }

        // Create new channel
        const channel = new Channel({
          name,
          description,
          is_private: isPrivate || false,
          created_by: socket.userId
        });

        await channel.save();

        // Add creator as admin member
        const channelMember = new ChannelMember({
          channel_id: channel._id,
          user_id: socket.userId,
          role: 'admin',
          joined_at: new Date()
        });

        await channelMember.save();

        // Add other members if specified
        if (members && Array.isArray(members)) {
          for (const memberId of members) {
            if (memberId !== socket.userId) {
              const member = new ChannelMember({
                channel_id: channel._id,
                user_id: memberId,
                role: 'member',
                joined_at: new Date()
              });
              await member.save();
            }
          }
        }

        // Join the creator to the channel
        socket.join(channel._id.toString());
        userChannels.get(socket.userId).add(channel._id.toString());

        // Emit channel created event
        socket.emit('channel_created', {
          channel: channel.getPublicInfo(),
          timestamp: new Date()
        });

        // Notify other users if it's a public channel
        if (!isPrivate) {
          socket.broadcast.emit('public_channel_created', {
            channel: channel.getPublicInfo(),
            createdBy: socket.userId,
            timestamp: new Date()
          });
        }

      } catch (error) {
        socket.emit('error', { message: 'Failed to create channel' });
      }
    });

    // Handle updating channel
    socket.on('update_channel', async (data) => {
      try {
        const { channelId, updates } = data;
        
        const channel = await Channel.findById(channelId);
        if (!channel) {
          socket.emit('error', { message: 'Channel not found' });
          return;
        }

        // Check if user has permission to update channel
        const membership = await ChannelMember.findOne({
          channel_id: channelId,
          user_id: socket.userId
        });

        if (!membership || (membership.role !== 'admin' && membership.role !== 'moderator')) {
          socket.emit('error', { message: 'Insufficient permissions to update channel' });
          return;
        }

        // Update channel
        Object.assign(channel, updates);
        channel.updated_at = new Date();
        await channel.save();

        // Emit channel updated event to all channel members
        io.to(channelId).emit('channel_updated', {
          channel: channel.getPublicInfo(),
          updatedBy: socket.userId,
          timestamp: new Date()
        });

      } catch (error) {
        socket.emit('error', { message: 'Failed to update channel' });
      }
    });

    // Handle deleting channel
    socket.on('delete_channel', async (data) => {
      try {
        const { channelId } = data;
        
        const channel = await Channel.findById(channelId);
        if (!channel) {
          socket.emit('error', { message: 'Channel not found' });
          return;
        }

        // Check if user has permission to delete channel
        const membership = await ChannelMember.findOne({
          channel_id: channelId,
          user_id: socket.userId
        });

        if (!membership || membership.role !== 'admin') {
          socket.emit('error', { message: 'Only channel admins can delete channels' });
          return;
        }

        // Soft delete channel
        channel.is_deleted = true;
        channel.deleted_at = new Date();
        channel.deleted_by = socket.userId;
        await channel.save();

        // Emit channel deleted event to all channel members
        io.to(channelId).emit('channel_deleted', {
          channelId,
          deletedBy: socket.userId,
          timestamp: new Date()
        });

        // Remove all users from the channel
        const members = await ChannelMember.find({ channel_id: channelId });
        members.forEach(member => {
          const memberSocket = connectedUsers.get(member.user_id.toString());
          if (memberSocket) {
            memberSocket.leave(channelId);
            userChannels.get(member.user_id.toString())?.delete(channelId);
          }
        });

      } catch (error) {
        socket.emit('error', { message: 'Failed to delete channel' });
      }
    });

    // Handle adding member to channel
    socket.on('add_channel_member', async (data) => {
      try {
        const { channelId, userId } = data;
        
        const channel = await Channel.findById(channelId);
        if (!channel) {
          socket.emit('error', { message: 'Channel not found' });
          return;
        }

        // Check if user has permission to add members
        const membership = await ChannelMember.findOne({
          channel_id: channelId,
          user_id: socket.userId
        });

        if (!membership || (membership.role !== 'admin' && membership.role !== 'moderator')) {
          socket.emit('error', { message: 'Insufficient permissions to add members' });
          return;
        }

        // Check if user is already a member
        const existingMember = await ChannelMember.findOne({
          channel_id: channelId,
          user_id: userId
        });

        if (existingMember) {
          socket.emit('error', { message: 'User is already a member of this channel' });
          return;
        }

        // Add new member
        const newMember = new ChannelMember({
          channel_id: channelId,
          user_id: userId,
          role: 'member',
          joined_at: new Date()
        });

        await newMember.save();

        // Emit member added event
        io.to(channelId).emit('member_added', {
          channelId,
          userId,
          addedBy: socket.userId,
          timestamp: new Date()
        });

        // Notify the added user if they're online
        const addedUserSocket = connectedUsers.get(userId);
        if (addedUserSocket) {
          addedUserSocket.emit('added_to_channel', {
            channel: channel.getPublicInfo(),
            addedBy: socket.userId,
            timestamp: new Date()
          });
        }

      } catch (error) {
        socket.emit('error', { message: 'Failed to add member to channel' });
      }
    });

    // Handle removing member from channel
    socket.on('remove_channel_member', async (data) => {
      try {
        const { channelId, userId } = data;
        
        const channel = await Channel.findById(channelId);
        if (!channel) {
          socket.emit('error', { message: 'Channel not found' });
          return;
        }

        // Check if user has permission to remove members
        const membership = await ChannelMember.findOne({
          channel_id: channelId,
          user_id: socket.userId
        });

        if (!membership || (membership.role !== 'admin' && membership.role !== 'moderator')) {
          socket.emit('error', { message: 'Insufficient permissions to remove members' });
          return;
        }

        // Check if trying to remove admin
        const targetMembership = await ChannelMember.findOne({
          channel_id: channelId,
          user_id: userId
        });

        if (targetMembership && targetMembership.role === 'admin') {
          socket.emit('error', { message: 'Cannot remove channel admin' });
          return;
        }

        // Remove member
        await ChannelMember.findOneAndDelete({
          channel_id: channelId,
          user_id: userId
        });

        // Emit member removed event
        io.to(channelId).emit('member_removed', {
          channelId,
          userId,
          removedBy: socket.userId,
          timestamp: new Date()
        });

        // Remove user from channel if they're online
        const removedUserSocket = connectedUsers.get(userId);
        if (removedUserSocket) {
          removedUserSocket.leave(channelId);
          userChannels.get(userId)?.delete(channelId);
          removedUserSocket.emit('removed_from_channel', {
            channelId,
            removedBy: socket.userId,
            timestamp: new Date()
          });
        }

      } catch (error) {
        socket.emit('error', { message: 'Failed to remove member from channel' });
      }
    });

    // Handle typing indicator
    socket.on('typing_start', (data) => {
      const { channelId } = data;
      
      if (!userChannels.get(socket.userId).has(channelId)) {
        return;
      }

      if (!typingUsers.has(channelId)) {
        typingUsers.set(channelId, new Set());
      }
      
      typingUsers.get(channelId).add(socket.userId);
      
      socket.to(channelId).emit('user_typing', {
        userId: socket.userId,
        username: socket.user.username,
        channelId
      });
    });

    socket.on('typing_stop', (data) => {
      const { channelId } = data;
      
      if (typingUsers.has(channelId)) {
        typingUsers.get(channelId).delete(socket.userId);
        
        if (typingUsers.get(channelId).size === 0) {
          typingUsers.delete(channelId);
        }
      }
      
      socket.to(channelId).emit('user_stopped_typing', {
        userId: socket.userId,
        username: socket.user.username,
        channelId
      });
    });

    // Handle new message
    socket.on('new_message', async (data) => {
      try {
        const { channelId, content, replyTo } = data;
        
        // Verify user is member of the channel
        const channel = await Channel.findById(channelId);
        if (!channel || !(await ChannelMember.isMember(channelId, socket.userId))) {
          socket.emit('error', { message: 'Access denied to channel' });
          return;
        }

        // Create new message
        const message = new Message({
          channel_id: channelId,
          user_id: socket.userId,
          content,
          reply_to: replyTo,
          message_type: 'text'
        });

        await message.save();
        await message.populate('user_id', 'username avatar');
        if (replyTo) {
          await message.populate('reply_to', 'content user_id');
        }

        // Emit to all users in the channel
        io.to(channelId).emit('message_received', {
          message: message.getPublicInfo(),
          channelId,
          timestamp: new Date()
        });

        // Stop typing indicator
        if (typingUsers.has(channelId)) {
          typingUsers.get(channelId).delete(socket.userId);
          if (typingUsers.get(channelId).size === 0) {
            typingUsers.delete(channelId);
          }
        }

        socket.to(channelId).emit('user_stopped_typing', {
          userId: socket.userId,
          username: socket.user.username,
          channelId
        });

      } catch (error) {
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle message update
    socket.on('update_message', async (data) => {
      try {
        const { messageId, content } = data;
        
        const message = await Message.findById(messageId);
        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        // Check if user is the author
        if (message.user_id.toString() !== socket.userId) {
          socket.emit('error', { message: 'You can only edit your own messages' });
          return;
        }

        // Check if message is too old (e.g., 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (message.created_at < fiveMinutesAgo) {
          socket.emit('error', { message: 'Messages can only be edited within 5 minutes of posting' });
          return;
        }

        message.content = content;
        message.updated_at = new Date();
        await message.save();

        // Emit updated message to all users in the channel
        io.to(message.channel_id.toString()).emit('message_updated', {
          message: message.getPublicInfo(),
          channelId: message.channel_id,
          timestamp: new Date()
        });

      } catch (error) {
        socket.emit('error', { message: 'Failed to update message' });
      }
    });

    // Handle message deletion
    socket.on('delete_message', async (data) => {
      try {
        const { messageId } = data;
        
        const message = await Message.findById(messageId).populate('channel_id');
        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        // Check if user is the author or has moderator role
        const isAuthor = message.user_id.toString() === socket.userId;
        const user = await User.findById(socket.userId);
        const isModerator = user.role === 'moderator' || user.role === 'admin';
        const hasChannelModeratorRole = message.channel_id && 
          await ChannelMember.hasRole(message.channel_id._id, socket.userId, 'moderator');

        if (!isAuthor && !isModerator && !hasChannelModeratorRole) {
          socket.emit('error', { message: 'You can only delete your own messages or need moderator privileges' });
          return;
        }

        // Soft delete the message
        await message.softDelete(socket.userId);

        // Emit deletion to all users in the channel
        io.to(message.channel_id._id.toString()).emit('message_deleted', {
          messageId,
          channelId: message.channel_id._id,
          deletedBy: socket.userId,
          timestamp: new Date()
        });

      } catch (error) {
        socket.emit('error', { message: 'Failed to delete message' });
      }
    });

    // Handle message flagging
    socket.on('flag_message', async (data) => {
      try {
        const { messageId, reason } = data;
        
        if (!reason || !['inappropriate', 'spam', 'harassment', 'other'].includes(reason)) {
          socket.emit('error', { message: 'Valid flag reason is required' });
          return;
        }

        const message = await Message.findById(messageId);
        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        // Check if message is already flagged
        if (message.is_flagged) {
          socket.emit('error', { message: 'Message is already flagged' });
          return;
        }

        // Flag the message
        await message.flag(reason, socket.userId);

        // Emit flag to moderators and admins
        const moderators = await User.find({ 
          role: { $in: ['moderator', 'admin'] },
          _id: { $in: Array.from(connectedUsers.keys()) }
        });

        moderators.forEach(mod => {
          const modSocket = connectedUsers.get(mod._id.toString());
          if (modSocket) {
            modSocket.emit('message_flagged', {
              message: message.getPublicInfo(),
              flaggedBy: socket.userId,
              reason,
              timestamp: new Date()
            });
          }
        });

        socket.emit('message_flagged_success', { message: 'Message flagged successfully' });

      } catch (error) {
        socket.emit('error', { message: 'Failed to flag message' });
      }
    });

    // Handle message unflagging (moderator only)
    socket.on('unflag_message', async (data) => {
      try {
        const { messageId } = data;
        
        const user = await User.findById(socket.userId);
        if (user.role !== 'moderator' && user.role !== 'admin') {
          socket.emit('error', { message: 'Moderator privileges required' });
          return;
        }

        const message = await Message.findById(messageId);
        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        if (!message.is_flagged) {
          socket.emit('error', { message: 'Message is not flagged' });
          return;
        }

        await message.unflag();

        // Emit unflag to all moderators
        const moderators = await User.find({ 
          role: { $in: ['moderator', 'admin'] },
          _id: { $in: Array.from(connectedUsers.keys()) }
        });

        moderators.forEach(mod => {
          const modSocket = connectedUsers.get(mod._id.toString());
          if (modSocket) {
            modSocket.emit('message_unflagged', {
              message: message.getPublicInfo(),
              unflaggedBy: socket.userId,
              timestamp: new Date()
            });
          }
        });

        socket.emit('message_unflagged_success', { message: 'Message unflagged successfully' });

      } catch (error) {
        socket.emit('error', { message: 'Failed to unflag message' });
      }
    });

    // Handle message search
    socket.on('search_messages', async (data) => {
      try {
        const { channelId, query, page = 1, limit = 50 } = data;
        
        if (!query) {
          socket.emit('error', { message: 'Search query is required' });
          return;
        }

        // Check if channel exists and user has access
        const channel = await Channel.findById(channelId);
        if (!channel) {
          socket.emit('error', { message: 'Channel not found' });
          return;
        }

        if (channel.is_private && !(await ChannelMember.isMember(channelId, socket.userId))) {
          socket.emit('error', { message: 'Access denied. You are not a member of this channel.' });
          return;
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

        socket.emit('search_results', {
          messages: messages.map(msg => msg.getPublicInfo()),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          },
          query,
          channelId
        });

      } catch (error) {
        socket.emit('error', { message: 'Failed to search messages' });
      }
    });

    // Handle getting message history
    socket.on('get_message_history', async (data) => {
      try {
        const { channelId, page = 1, limit = 50 } = data;
        
        // Check if channel exists
        const channel = await Channel.findById(channelId);
        if (!channel) {
          socket.emit('error', { message: 'Channel not found' });
          return;
        }

        // Check if user is member (for private channels)
        if (channel.is_private && !(await ChannelMember.isMember(channelId, socket.userId))) {
          socket.emit('error', { message: 'Access denied. You are not a member of this channel.' });
          return;
        }

        // Get messages with pagination
        const messages = await Message.getChannelMessages(channelId, page, limit);

        // Get total count for pagination
        const total = await Message.countDocuments({
          channel_id: channelId,
          is_deleted: false
        });

        socket.emit('message_history', {
          messages: messages.map(msg => ({
            ...msg,
            user_id: msg.user_id ? {
              id: msg.user_id._id,
              username: msg.user_id.username,
              avatar: msg.user_id.avatar
            } : null,
            reply_to: msg.reply_to ? {
              id: msg.reply_to._id,
              content: msg.reply_to.content,
              user_id: msg.reply_to.user_id
            } : null
          })),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          },
          channelId
        });

      } catch (error) {
        socket.emit('error', { message: 'Failed to get message history' });
      }
    });

    // Handle message delivery confirmation
    socket.on('message_delivered', (data) => {
      const { messageId, channelId } = data;
      
      // Emit delivery confirmation to message sender
      socket.to(channelId).emit('message_delivered', {
        messageId,
        deliveredTo: socket.userId,
        timestamp: new Date()
      });
    });

    // Handle message read confirmation
    socket.on('message_read', (data) => {
      const { messageId, channelId } = data;
      
      // Emit read confirmation to message sender
      socket.to(channelId).emit('message_read', {
        messageId,
        readBy: socket.userId,
        timestamp: new Date()
      });
    });

    // Handle user status updates
    socket.on('status_update', async (data) => {
      try {
        const { status } = data;
        
        // Update user status in database
        await User.findByIdAndUpdate(socket.userId, {
          last_seen: new Date()
        });

        // Emit status update to all connected users
        socket.broadcast.emit('user_status_updated', {
          userId: socket.userId,
          username: socket.user.username,
          status,
          timestamp: new Date()
        });
      } catch (error) {
        socket.emit('error', { message: 'Failed to update status' });
      }
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`User ${socket.user.username} disconnected: ${socket.id}`);

      // Update user offline status
      await User.findByIdAndUpdate(socket.userId, {
        is_online: false,
        last_seen: new Date()
      });

      // Remove from typing indicators
      userChannels.get(socket.userId)?.forEach(channelId => {
        if (typingUsers.has(channelId)) {
          typingUsers.get(channelId).delete(socket.userId);
          if (typingUsers.get(channelId).size === 0) {
            typingUsers.delete(channelId);
          }
        }
      });

      // Clean up socket mappings
      connectedUsers.delete(socket.userId);
      userChannels.delete(socket.userId);

      // Emit user offline status
      socket.broadcast.emit('user_offline', {
        userId: socket.userId,
        username: socket.user.username,
        timestamp: new Date()
      });
    });
  });

  // Make io available to routes
  io.app = io;
};

// Utility functions for routes to use
const emitToChannel = (channelId, event, data) => {
  if (io && io.app) {
    io.app.to(channelId).emit(event, data);
  }
};

const emitToUser = (userId, event, data) => {
  const socket = connectedUsers.get(userId);
  if (socket) {
    socket.emit(event, data);
  }
};

const getOnlineUsers = () => {
  return Array.from(connectedUsers.keys());
};

const getUserChannels = (userId) => {
  return Array.from(userChannels.get(userId) || []);
};

module.exports = {
  setupWebSocket,
  emitToChannel,
  emitToUser,
  getOnlineUsers,
  getUserChannels
};
