const channelService = require('../services/channelService');

class ChannelController {
  /**
   * Create a new channel
   */
  async createChannel(req, res) {
    try {
      const channelData = {
        name: req.body.name,
        description: req.body.description || '',
        is_private: req.body.isPrivate || false
      };

      const channel = await channelService.createChannel(channelData, req.user.id);
      
      // Populate creator info for response
      await channel.populate('created_by', 'username avatar');

      res.status(201).json({
        success: true,
        message: 'Channel created successfully',
        channel: channel.getPublicInfo()
      });
    } catch (error) {
      if (error.message === 'Channel name already exists') {
        return res.status(409).json({
          success: false,
          error: error.message
        });
      }
      throw error;
    }
  }

  /**
   * Get user's channels
   */
  async getUserChannels(req, res) {
    try {
      const { page = 1, limit = 50, search } = req.query;
      
      const userChannels = await channelService.getUserChannels(req.user.id, page, limit);
      
      // Get total count
      const total = await require('../models/ChannelMember').countDocuments({
        user_id: req.user.id,
        is_active: true
      });

      // Filter by search if provided
      let filteredChannels = userChannels;
      if (search) {
        filteredChannels = userChannels.filter(membership => 
          membership.channel_id.name.toLowerCase().includes(search.toLowerCase())
        );
      }

      res.json({
        channels: filteredChannels.map(membership => ({
          ...membership.channel_id.getPublicInfo(),
          role: membership.role,
          joined_at: membership.joined_at
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get public channels
   */
  async getPublicChannels(req, res) {
    try {
      const { page = 1, limit = 50, search } = req.query;
      
      const channels = await channelService.getPublicChannels(page, limit, search);
      const total = await require('../models/Channel').countDocuments({ 
        is_private: false, 
        is_deleted: { $ne: true } 
      });

      res.json({
        channels: channels.map(channel => channel.getPublicInfo()),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get channel by ID
   */
  async getChannelById(req, res) {
    try {
      const { id: channelId } = req.params;
      
      const channel = await channelService.getChannelById(channelId);

      // Check if user is member (for private channels)
      if (channel.is_private && !(await channelService.isUserMember(channelId, req.user.id))) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You are not a member of this channel.'
        });
      }

      // Get channel members
      const members = await channelService.getChannelMembers(channelId, 1, 1000);

      res.json({
        channel: {
          ...channel.getPublicInfo(),
          members: members.map(member => ({
            user_id: member.user_id,
            role: member.role,
            joined_at: member.joined_at
          }))
        }
      });
    } catch (error) {
      if (error.message === 'Channel not found') {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      throw error;
    }
  }

  /**
   * Join channel
   */
  async joinChannel(req, res) {
    try {
      const { id: channelId } = req.params;
      
      await channelService.joinChannel(channelId, req.user.id);

      // Emit to WebSocket for real-time updates
      if (req.app.get('io')) {
        req.app.get('io').to(channelId).emit('user_joined_channel', {
          userId: req.user.id,
          username: req.user.username,
          channelId,
          timestamp: new Date()
        });
      }

      res.json({
        success: true,
        message: 'Successfully joined the channel'
      });
    } catch (error) {
      if (error.message === 'Channel not found') {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      if (error.message === 'Cannot join private channel') {
        return res.status(403).json({
          success: false,
          error: error.message
        });
      }
      if (error.message === 'Already a member of this channel') {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }
      throw error;
    }
  }

  /**
   * Leave channel
   */
  async leaveChannel(req, res) {
    try {
      const { id: channelId } = req.params;
      
      await channelService.leaveChannel(channelId, req.user.id);

      // Emit to WebSocket for real-time updates
      if (req.app.get('io')) {
        req.app.get('io').to(channelId).emit('user_left_channel', {
          userId: req.user.id,
          username: req.user.username,
          channelId,
          timestamp: new Date()
        });
      }

      res.json({
        success: true,
        message: 'Successfully left the channel'
      });
    } catch (error) {
      if (error.message === 'Channel not found') {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      if (error.message === 'Not a member of this channel') {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }
      if (error.message.includes('Channel creator cannot leave')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }
      throw error;
    }
  }

  /**
   * Get channel members
   */
  async getChannelMembers(req, res) {
    try {
      const { id: channelId } = req.params;
      const { page = 1, limit = 50 } = req.query;

      const channel = await channelService.getChannelById(channelId);

      // Check if user is member (for private channels)
      if (channel.is_private && !(await channelService.isUserMember(channelId, req.user.id))) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You are not a member of this channel.'
        });
      }

      const members = await channelService.getChannelMembers(channelId, page, limit);
      const total = await require('../models/ChannelMember').countDocuments({
        channel_id: channelId,
        is_active: true
      });

      res.json({
        members: members.map(member => ({
          user_id: member.user_id,
          role: member.role,
          joined_at: member.joined_at
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      if (error.message === 'Channel not found') {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      throw error;
    }
  }

  /**
   * Add member to channel
   */
  async addMemberToChannel(req, res) {
    try {
      const { id: channelId } = req.params;
      const { user_id, role = 'member' } = req.body;

      // Check if current user has permission to add members
      const currentMember = await require('../models/ChannelMember').findOne({
        channel_id: channelId,
        user_id: req.user.id,
        is_active: true
      });

      if (!currentMember || !['admin', 'moderator'].includes(currentMember.role)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions to add members to this channel'
        });
      }

      await channelService.addMemberToChannel(channelId, user_id, role, req.user.id);

      // Emit to WebSocket for real-time updates
      if (req.app.get('io')) {
        req.app.get('io').to(channelId).emit('member_added', {
          channelId,
          userId: user_id,
          addedBy: req.user.id,
          timestamp: new Date()
        });
      }

      res.json({
        success: true,
        message: 'Member added successfully to the channel'
      });
    } catch (error) {
      if (error.message === 'Channel not found') {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      if (error.message === 'User not found') {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      if (error.message === 'User is already a member of this channel') {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }
      throw error;
    }
  }

  /**
   * Remove member from channel
   */
  async removeMemberFromChannel(req, res) {
    try {
      const { id: channelId, userId } = req.params;

      // Check if current user has permission to remove members
      const currentMember = await require('../models/ChannelMember').findOne({
        channel_id: channelId,
        user_id: req.user.id,
        is_active: true
      });

      if (!currentMember || !['admin', 'moderator'].includes(currentMember.role)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions to remove members from this channel'
        });
      }

      await channelService.removeMemberFromChannel(channelId, userId, req.user.id);

      // Emit to WebSocket for real-time updates
      if (req.app.get('io')) {
        req.app.get('io').to(channelId).emit('member_removed', {
          channelId,
          userId,
          removedBy: req.user.id,
          timestamp: new Date()
        });
      }

      res.json({
        success: true,
        message: 'Member removed successfully from the channel'
      });
    } catch (error) {
      if (error.message === 'Channel not found') {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      if (error.message === 'User not found') {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      if (error.message === 'Cannot remove the channel creator') {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }
      if (error.message === 'User is not a member of this channel') {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }
      throw error;
    }
  }

  /**
   * Update channel
   */
  async updateChannel(req, res) {
    try {
      const { id: channelId } = req.params;
      const updateData = {
        name: req.body.name,
        description: req.body.description,
        is_private: req.body.is_private
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => 
        updateData[key] === undefined && delete updateData[key]
      );

      const channel = await channelService.updateChannel(channelId, updateData, req.user.id);

      // Emit to WebSocket for real-time updates
      if (req.app.get('io')) {
        req.app.get('io').to(channelId).emit('channel_updated', {
          channel: channel.getPublicInfo(),
          updatedBy: req.user.id,
          timestamp: new Date()
        });
      }

      res.json({
        success: true,
        message: 'Channel updated successfully',
        channel: channel.getPublicInfo()
      });
    } catch (error) {
      if (error.message === 'Channel not found') {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      if (error.message === 'Insufficient permissions to update this channel') {
        return res.status(403).json({
          success: false,
          error: error.message
        });
      }
      throw error;
    }
  }

  /**
   * Delete channel
   */
  async deleteChannel(req, res) {
    try {
      const { id: channelId } = req.params;
      
      await channelService.deleteChannel(channelId, req.user.id);

      // Emit to WebSocket for real-time updates
      if (req.app.get('io')) {
        req.app.get('io').to(channelId).emit('channel_deleted', {
          channelId,
          deletedBy: req.user.id,
          timestamp: new Date()
        });
      }

      res.json({
        success: true,
        message: 'Channel deleted successfully'
      });
    } catch (error) {
      if (error.message === 'Channel not found') {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      if (error.message === 'Insufficient permissions to delete this channel') {
        return res.status(403).json({
          success: false,
          error: error.message
        });
      }
      throw error;
    }
  }

  /**
   * Get channel statistics
   */
  async getChannelStats(req, res) {
    try {
      const { id: channelId } = req.params;
      
      const stats = await channelService.getChannelStats(channelId);

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      if (error.message === 'Channel not found') {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      throw error;
    }
  }
}

module.exports = new ChannelController();
