const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
    default: ''
  },
  is_private: {
    type: Boolean,
    default: false
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  settings: {
    allow_guest_messages: {
      type: Boolean,
      default: false
    },
    require_approval: {
      type: Boolean,
      default: false
    },
    max_members: {
      type: Number,
      default: 1000
    }
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
channelSchema.index({ name: 1 });
channelSchema.index({ created_by: 1 });
channelSchema.index({ is_private: 1 });

// Virtual for member count
channelSchema.virtual('member_count').get(function() {
  // This will be populated when needed
  return 0;
});

// Method to get public channel info
channelSchema.methods.getPublicInfo = function() {
  return {
    id: this._id,
    name: this.name,
    description: this.description,
    is_private: this.is_private,
    created_by: this.created_by,
    member_count: this.member_count,
    created_at: this.created_at,
    updated_at: this.updated_at
  };
};

module.exports = mongoose.model('Channel', channelSchema);
