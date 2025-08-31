const Channel = require('../models/Channel');
const ChannelMember = require('../models/ChannelMember');
const User = require('../models/User');

/**
 * Create a new channel
 */
async function createChannel(channelData, creatorId) {
  try {
    // Check if channel name already exists
    const existingChannel = await Channel.findOne({ 
      name: channelData.name,
      is_deleted: { $ne: true }
    });

    if (existingChannel) {
      throw new Error('Channel name already exists');
    }

    // Create channel
    const channel = new Channel({
      ...channelData,
      created_by: creatorId,
      member_count: 1
    });

    await channel.save();

    // Add creator as admin member
    await ChannelMember.create({
      channel_id: channel._id,
      user_id: creatorId,
      role: 'admin'
    });

    return channel;
  } catch (error) {
    throw error;
  }
}

/**
 * Get user's channels with pagination
 */
async function getUserChannels(userId, page = 1, limit = 50) {
  try {
    const skip = (page - 1) * limit;
    
    const memberships = await ChannelMember.find({
      user_id: userId,
      is_active: true
    })
      .populate({
        path: 'channel_id',
        populate: {
          path: 'created_by',
          select: 'username avatar'
        }
      })
      .sort({ 'channel_id.created_at': -1 })
      .skip(skip)
      .limit(limit);

    return memberships;
  } catch (error) {
    throw error;
  }
}

/**
 * Get public channels with pagination and search
 */
async function getPublicChannels(page = 1, limit = 50, search = '') {
  try {
    const skip = (page - 1) * limit;
    
    const query = { is_private: false, is_deleted: { $ne: true } };
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const channels = await Channel.find(query)
      .populate('created_by', 'username avatar')
      .sort({ member_count: -1, created_at: -1 })
      .skip(skip)
      .limit(limit);

    return channels;
  } catch (error) {
    throw error;
  }
}

/**
 * Get channel by ID with populated data
 */
async function getChannelById(channelId) {
  try {
    const channel = await Channel.findById(channelId)
      .populate('created_by', 'username avatar');

    if (!channel) {
      throw new Error('Channel not found');
    }

    return channel;
  } catch (error) {
    throw error;
  }
}

/**
 * Check if user is member of channel
 */
async function isUserMember(channelId, userId) {
  try {
    const member = await ChannelMember.findOne({
      channel_id: channelId,
      user_id: userId,
      is_active: true
    });

    return !!member;
  } catch (error) {
    throw error;
  }
}

/**
 * Get user's role in channel
 */
async function getUserRole(channelId, userId) {
  try {
    const member = await ChannelMember.findOne({
      channel_id: channelId,
      user_id: userId,
      is_active: true
    });

    return member ? member.role : null;
  } catch (error) {
    throw error;
  }
}

/**
 * Add member to channel
 */
async function addMemberToChannel(channelId, userId, role = 'member', invitedBy) {
  try {
    // Check if channel exists
    const channel = await Channel.findById(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user is already an active member
    const existingMember = await ChannelMember.findOne({
      channel_id: channelId,
      user_id: userId
    });

    if (existingMember && existingMember.is_active) {
      throw new Error('User is already a member of this channel');
    }

    let member;
    if (existingMember) {
      // Reactivate existing membership
      existingMember.is_active = true;
      existingMember.role = role;
      existingMember.last_activity = new Date();
      existingMember.invited_by = invitedBy;
      member = await existingMember.save();
    } else {
      // Create new membership
      member = await ChannelMember.create({
        channel_id: channelId,
        user_id: userId,
        role: role,
        invited_by: invitedBy
      });
    }

    // Update channel member count
    await Channel.findByIdAndUpdate(channelId, {
      $inc: { member_count: 1 }
    });

    return member;
  } catch (error) {
    throw error;
  }
}

/**
 * Remove member from channel
 */
async function removeMemberFromChannel(channelId, userId, removedBy) {
  try {
    // Check if channel exists
    const channel = await Channel.findById(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if trying to remove channel creator
    if (channel.created_by.toString() === userId) {
      throw new Error('Cannot remove the channel creator');
    }

    // Check if user is a member
    const member = await ChannelMember.findOne({
      channel_id: channelId,
      user_id: userId,
      is_active: true
    });

    if (!member) {
      throw new Error('User is not a member of this channel');
    }

    // Deactivate membership
    member.is_active = false;
    member.last_activity = new Date();
    await member.save();

    // Update channel member count
    await Channel.findByIdAndUpdate(channelId, {
      $inc: { member_count: -1 }
    });

    return member;
  } catch (error) {
    throw error;
  }
}

/**
 * Get channel members with pagination
 */
async function getChannelMembers(channelId, page = 1, limit = 50) {
  try {
    const skip = (page - 1) * limit;
    
    const members = await ChannelMember.find({
      channel_id: channelId,
      is_active: true
    })
      .populate('user_id', 'username avatar')
      .populate('invited_by', 'username')
      .sort({ role: 1, joined_at: 1 })
      .skip(skip)
      .limit(limit);

    return members;
  } catch (error) {
    throw error;
  }
}

/**
 * Update channel information
 */
async function updateChannel(channelId, updateData, userId) {
  try {
    const channel = await Channel.findById(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    // Check if user has permission to update
    const member = await ChannelMember.findOne({
      channel_id: channelId,
      user_id: userId,
      is_active: true
    });

    if (!member || !['admin', 'moderator'].includes(member.role)) {
      throw new Error('Insufficient permissions to update this channel');
    }

    // Update channel
    Object.assign(channel, updateData);
    await channel.save();

    return channel;
  } catch (error) {
    throw error;
  }
}

/**
 * Delete channel
 */
async function deleteChannel(channelId, userId) {
  try {
    const channel = await Channel.findById(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    // Check if user is the creator or admin
    if (channel.created_by.toString() !== userId) {
      const user = await User.findById(userId);
      if (!user || user.role !== 'admin') {
        throw new Error('Insufficient permissions to delete this channel');
      }
    }

    // Delete channel members
    await ChannelMember.deleteMany({ channel_id: channelId });

    // Delete channel
    await Channel.findByIdAndDelete(channelId);

    return true;
  } catch (error) {
    throw error;
  }
}

/**
 * Join public channel
 */
async function joinChannel(channelId, userId) {
  try {
    const channel = await Channel.findById(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    // Check if channel is private
    if (channel.is_private) {
      throw new Error('Cannot join private channel');
    }

    // Check if already a member
    const existingMember = await ChannelMember.findOne({
      channel_id: channelId,
      user_id: userId
    });

    if (existingMember && existingMember.is_active) {
      throw new Error('Already a member of this channel');
    }

    let member;
    if (existingMember) {
      // Reactivate membership
      existingMember.is_active = true;
      existingMember.last_activity = new Date();
      member = await existingMember.save();
    } else {
      // Add new member
      member = await ChannelMember.create({
        channel_id: channelId,
        user_id: userId,
        role: 'member'
      });
    }

    // Update channel member count
    await Channel.findByIdAndUpdate(channelId, {
      $inc: { member_count: 1 }
    });

    return member;
  } catch (error) {
    throw error;
  }
}

/**
 * Leave channel
 */
async function leaveChannel(channelId, userId) {
  try {
    const channel = await Channel.findById(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    // Check if user is a member
    const member = await ChannelMember.findOne({
      channel_id: channelId,
      user_id: userId,
      is_active: true
    });

    if (!member) {
      throw new Error('Not a member of this channel');
    }

    // Check if user is the creator
    if (channel.created_by.toString() === userId) {
      throw new Error('Channel creator cannot leave. Transfer ownership or delete the channel.');
    }

    // Deactivate membership
    member.is_active = false;
    member.last_activity = new Date();
    await member.save();

    // Update channel member count
    await Channel.findByIdAndUpdate(channelId, {
      $inc: { member_count: -1 }
    });

    return member;
  } catch (error) {
    throw error;
  }
}

/**
 * Get channel statistics
 */
async function getChannelStats(channelId) {
  try {
    const [memberCount, messageCount, activeMembers] = await Promise.all([
      ChannelMember.countDocuments({ channel_id: channelId, is_active: true }),
      require('../models/Message').countDocuments({ channel_id: channelId, is_deleted: false }),
      ChannelMember.countDocuments({ 
        channel_id: channelId, 
        is_active: true,
        last_activity: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      })
    ]);

    return {
      member_count: memberCount,
      message_count: messageCount,
      active_members_24h: activeMembers
    };
  } catch (error) {
    throw error;
  }
}

module.exports = {
  createChannel,
  getUserChannels,
  getPublicChannels,
  getChannelById,
  isUserMember,
  getUserRole,
  addMemberToChannel,
  removeMemberFromChannel,
  getChannelMembers,
  updateChannel,
  deleteChannel,
  joinChannel,
  leaveChannel,
  getChannelStats
};
