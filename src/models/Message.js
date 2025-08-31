const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
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
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  message_type: {
    type: String,
    enum: ['text', 'image', 'file', 'system'],
    default: 'text'
  },
  is_flagged: {
    type: Boolean,
    default: false
  },
  flag_reason: {
    type: String,
    enum: ['inappropriate', 'spam', 'harassment', 'other'],
    default: undefined
  },
  flagged_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  flagged_at: {
    type: Date,
    default: null
  },
  is_deleted: {
    type: Boolean,
    default: false
  },
  deleted_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  deleted_at: {
    type: Date,
    default: null
  },
  reply_to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  attachments: [{
    filename: String,
    original_name: String,
    mime_type: String,
    size: Number,
    url: String
  }],
  metadata: {
    ip_address: String,
    user_agent: String,
    location: String
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes
messageSchema.index({ channel_id: 1, created_at: -1 });
messageSchema.index({ user_id: 1 });
messageSchema.index({ is_flagged: 1 });
messageSchema.index({ is_deleted: 1 });
messageSchema.index({ reply_to: 1 });

// Method to flag message
messageSchema.methods.flag = function(reason, flaggedBy) {
  this.is_flagged = true;
  this.flag_reason = reason;
  this.flagged_by = flaggedBy;
  this.flagged_at = new Date();
  
  return this.save();
};

// Method to unflag message
messageSchema.methods.unflag = function() {
  this.is_flagged = false;
  this.flag_reason = undefined;
  this.flagged_by = undefined;
  this.flagged_at = undefined;
  
  return this.save();
};

// Method to soft delete message
messageSchema.methods.softDelete = function(deletedBy) {
  this.is_deleted = true;
  this.deleted_by = deletedBy;
  this.deleted_at = new Date();
  
  return this.save();
};

// Method to restore message
messageSchema.methods.restore = function() {
  this.is_deleted = false;
  this.deleted_by = undefined;
  this.deleted_at = undefined;
  
  return this.save();
};

// Method to get public message info
messageSchema.methods.getPublicInfo = function() {
  return {
    id: this._id,
    channel_id: this.channel_id,
    user_id: this.user_id,
    content: this.content,
    message_type: this.message_type,
    is_flagged: this.is_flagged,
    flag_reason: this.flag_reason,
    is_deleted: this.is_deleted,
    reply_to: this.reply_to,
    attachments: this.attachments,
    created_at: this.created_at,
    updated_at: this.updated_at
  };
};

// Static method to get messages by channel with pagination
messageSchema.statics.getChannelMessages = function(channelId, page = 1, limit = 50) {
  const skip = (page - 1) * limit;
  
  return this.find({
    channel_id: channelId,
    is_deleted: false
  })
  .sort({ created_at: -1 })
  .skip(skip)
  .limit(limit)
  .populate('user_id', 'username avatar')
  .populate('reply_to', 'content user_id')
  .lean();
};

// Static method to get flagged messages
messageSchema.statics.getFlaggedMessages = function(page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  return this.find({
    is_flagged: true,
    is_deleted: false
  })
  .sort({ flagged_at: -1 })
  .skip(skip)
  .limit(limit)
  .populate('user_id', 'username')
  .populate('flagged_by', 'username')
  .populate('channel_id', 'name')
  .lean();
};

module.exports = mongoose.model('Message', messageSchema);
