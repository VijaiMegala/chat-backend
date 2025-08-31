const Filter = require('bad-words');
const Message = require('../models/Message');

// Initialize profanity filter
const filter = new Filter();
filter.addWords('custom', 'bad', 'words'); // Add custom words if needed

// Profanity filter middleware
const profanityFilter = (req, res, next) => {
  if (!process.env.PROFANITY_FILTER_ENABLED || process.env.PROFANITY_FILTER_ENABLED === 'false') {
    return next();
  }

  const { content } = req.body;
  
  if (content && filter.isProfane(content)) {
    return res.status(400).json({
      error: 'Message contains inappropriate content. Please revise and try again.'
    });
  }

  next();
};

// Spam prevention middleware
const spamPrevention = async (req, res, next) => {
  if (!process.env.SPAM_PREVENTION_ENABLED || process.env.SPAM_PREVENTION_ENABLED === 'false') {
    return next();
  }

  try {
    const userId = req.user.id;
    const channelId = req.params.id || req.body.channel_id;
    
    if (!userId || !channelId) {
      return next();
    }

    // Check for recent messages from the same user in the same channel
    const recentMessage = await Message.findOne({
      user_id: userId,
      channel_id: channelId,
      created_at: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
    });

    if (recentMessage) {
      return res.status(429).json({
        error: 'Please wait before sending another message to prevent spam.'
      });
    }

    // Check for duplicate content
    const duplicateMessage = await Message.findOne({
      user_id: userId,
      channel_id: channelId,
      content: req.body.content,
      created_at: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
    });

    if (duplicateMessage) {
      return res.status(400).json({
        error: 'Duplicate message detected. Please avoid sending the same content repeatedly.'
      });
    }

    next();
  } catch (error) {
    console.error('Spam prevention error:', error);
    next(); // Continue if there's an error
  }
};

// Content length validation
const contentLengthValidation = (req, res, next) => {
  const { content } = req.body;
  
  if (!content) {
    return next();
  }

  // Check for extremely long content (potential spam)
  if (content.length > 2000) {
    return res.status(400).json({
      error: 'Message content is too long. Maximum length is 2000 characters.'
    });
  }

  // Check for repeated characters (potential spam)
  const repeatedChars = /(.)\1{10,}/;
  if (repeatedChars.test(content)) {
    return res.status(400).json({
      error: 'Message contains too many repeated characters. Please revise and try again.'
    });
  }

  next();
};

// URL validation to prevent spam links
const urlValidation = (req, res, next) => {
  const { content } = req.body;
  
  if (!content) {
    return next();
  }

  // Simple URL detection
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = content.match(urlRegex);
  
  if (urls && urls.length > 3) {
    return res.status(400).json({
      error: 'Too many URLs in message. Please limit to 3 URLs per message.'
    });
  }

  next();
};

// Combined content moderation middleware
const contentModeration = [
  profanityFilter,
  spamPrevention,
  contentLengthValidation,
  urlValidation
];

module.exports = {
  profanityFilter,
  spamPrevention,
  contentLengthValidation,
  urlValidation,
  contentModeration
};
