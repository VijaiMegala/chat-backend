const mongoose = require('mongoose');

const channelMemberSchema = new mongoose.Schema({
  channel_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Channel',
    required: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    enum: ['member', 'moderator', 'admin'],
    default: 'member'
  },
  joined_at: {
    type: Date,
    default: Date.now
  },
  invited_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  is_active: {
    type: Boolean,
    default: true
  },
  last_activity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'joined_at', updatedAt: 'updated_at' }
});

// Compound index to ensure unique channel-user combinations
channelMemberSchema.index({ channel_id: 1, user_id: 1 }, { unique: true });

// Indexes for efficient queries
channelMemberSchema.index({ user_id: 1 });
channelMemberSchema.index({ channel_id: 1, role: 1 });
channelMemberSchema.index({ is_active: 1 });

// Static method to add member to channel
channelMemberSchema.statics.addMember = async function(channelId, userId, role = 'member', invitedBy = null) {
  try {
    // Check if member already exists
    const existingMember = await this.findOne({
      channel_id: channelId,
      user_id: userId
    });

    if (existingMember) {
      // Update existing member
      existingMember.role = role;
      existingMember.is_active = true;
      existingMember.last_activity = new Date();
      if (invitedBy) {
        existingMember.invited_by = invitedBy;
      }
      return await existingMember.save();
    } else {
      // Create new member
      return await this.create({
        channel_id: channelId,
        user_id: userId,
        role: role,
        invited_by: invitedBy
      });
    }
  } catch (error) {
    throw error;
  }
};

// Static method to remove member from channel
channelMemberSchema.statics.removeMember = async function(channelId, userId) {
  return await this.findOneAndDelete({
    channel_id: channelId,
    user_id: userId
  });
};

// Static method to check if user is member
channelMemberSchema.statics.isMember = async function(channelId, userId) {
  const member = await this.findOne({
    channel_id: channelId,
    user_id: userId,
    is_active: true
  });
  return !!member;
};

// Static method to get user role in channel
channelMemberSchema.statics.getUserRole = async function(channelId, userId) {
  const member = await this.findOne({
    channel_id: channelId,
    user_id: userId,
    is_active: true
  });
  return member ? member.role : null;
};

// Static method to check if user has role
channelMemberSchema.statics.hasRole = async function(channelId, userId, requiredRole) {
  const member = await this.findOne({
    channel_id: channelId,
    user_id: userId,
    is_active: true
  });

  if (!member) return false;

  const roleHierarchy = {
    'member': 1,
    'moderator': 2,
    'admin': 3
  };

  return roleHierarchy[member.role] >= roleHierarchy[requiredRole];
};

// Static method to get channel members
channelMemberSchema.statics.getChannelMembers = async function(channelId, page = 1, limit = 50) {
  const skip = (page - 1) * limit;
  
  return await this.find({
    channel_id: channelId,
    is_active: true
  })
  .populate('user_id', 'username avatar is_online last_seen')
  .populate('invited_by', 'username')
  .sort({ role: -1, joined_at: 1 })
  .skip(skip)
  .limit(limit);
};

// Static method to get user channels
channelMemberSchema.statics.getUserChannels = async function(userId, page = 1, limit = 50) {
  const skip = (page - 1) * limit;
  
  return await this.find({
    user_id: userId,
    is_active: true
  })
  .populate('channel_id', 'name description is_private created_by')
  .populate('channel_id.created_by', 'username avatar')
  .sort({ joined_at: -1 })
  .skip(skip)
  .limit(limit);
};

// Static method to get member count for a channel
channelMemberSchema.statics.getMemberCount = async function(channelId) {
  return await this.countDocuments({
    channel_id: channelId,
    is_active: true
  });
};

module.exports = mongoose.model('ChannelMember', channelMemberSchema);
