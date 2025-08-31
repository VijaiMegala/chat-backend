const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('../src/models/User');
const Channel = require('../src/models/Channel');
const ChannelMember = require('../src/models/ChannelMember');
const Message = require('../src/models/Message');

// Database connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.NODE_ENV === 'production' 
      ? process.env.MONGODB_URI_PROD 
      : process.env.MONGODB_URI || 'mongodb://localhost:27017/chat_app';
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Create indexes
const createIndexes = async () => {
  try {
    console.log('Creating database indexes...');
    
    // User indexes
    await User.collection.createIndex({ email: 1 }, { unique: true });
    await User.collection.createIndex({ username: 1 }, { unique: true });
    await User.collection.createIndex({ role: 1 });
    
    // Channel indexes
    await Channel.collection.createIndex({ name: 1 }, { unique: true });
    await Channel.collection.createIndex({ created_by: 1 });
    await Channel.collection.createIndex({ is_private: 1 });
    
    // ChannelMember indexes
    await ChannelMember.collection.createIndex({ channel_id: 1, user_id: 1 }, { unique: true });
    await ChannelMember.collection.createIndex({ user_id: 1 });
    await ChannelMember.collection.createIndex({ channel_id: 1, role: 1 });
    await ChannelMember.collection.createIndex({ is_active: 1 });
    
    // Message indexes
    await Message.collection.createIndex({ channel_id: 1, created_at: -1 });
    await Message.collection.createIndex({ user_id: 1 });
    await Message.collection.createIndex({ is_flagged: 1 });
    await Message.collection.createIndex({ is_deleted: 1 });
    await Message.collection.createIndex({ reply_to: 1 });
    
    console.log('Database indexes created successfully');
  } catch (error) {
    console.error('Error creating indexes:', error);
  }
};

// Create sample data
const createSampleData = async () => {
  try {
    console.log('Creating sample data...');
    
    // Check if sample data already exists
    const existingUsers = await User.countDocuments();
    if (existingUsers > 0) {
      console.log('Sample data already exists, skipping...');
      return;
    }
    
    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 12);
    const adminUser = new User({
      username: 'admin',
      email: 'admin@chatapp.com',
      password: adminPassword,
      role: 'admin',
      avatar: 'https://via.placeholder.com/150/FF6B6B/FFFFFF?text=A'
    });
    await adminUser.save();
    console.log('Admin user created:', adminUser.username);
    
    // Create moderator user
    const modPassword = await bcrypt.hash('mod123', 12);
    const modUser = new User({
      username: 'moderator',
      email: 'mod@chatapp.com',
      password: modPassword,
      role: 'moderator',
      avatar: 'https://via.placeholder.com/150/4ECDC4/FFFFFF?text=M'
    });
    await modUser.save();
    console.log('Moderator user created:', modUser.username);
    
    // Create regular users
    const userPasswords = await Promise.all([
      bcrypt.hash('user123', 12),
      bcrypt.hash('user456', 12),
      bcrypt.hash('user789', 12)
    ]);
    
    const regularUsers = [
      {
        username: 'john_doe',
        email: 'john@example.com',
        password: userPasswords[0],
        avatar: 'https://via.placeholder.com/150/45B7D1/FFFFFF?text=J'
      },
      {
        username: 'jane_smith',
        email: 'jane@example.com',
        password: userPasswords[1],
        avatar: 'https://via.placeholder.com/150/96CEB4/FFFFFF?text=J'
      },
      {
        username: 'bob_wilson',
        email: 'bob@example.com',
        password: userPasswords[2],
        avatar: 'https://via.placeholder.com/150/FFEAA7/FFFFFF?text=B'
      }
    ];
    
    const savedUsers = await User.insertMany(regularUsers);
    console.log('Regular users created:', savedUsers.length);
    
    // Create sample channels
    const channels = [
      {
        name: 'general',
        description: 'General discussion channel for all users',
        is_private: false,
        created_by: adminUser._id
      },
      {
        name: 'random',
        description: 'Random topics and casual conversation',
        is_private: false,
        created_by: modUser._id
      },
      {
        name: 'help',
        description: 'Get help and support from the community',
        is_private: false,
        created_by: adminUser._id
      },
      {
        name: 'admin-only',
        description: 'Administrative discussions',
        is_private: true,
        created_by: adminUser._id
      }
    ];
    
    const savedChannels = await Channel.insertMany(channels);
    console.log('Channels created:', savedChannels.length);
    
    // Add users to channels
    for (const channel of savedChannels) {
      if (channel.name === 'admin-only') {
        // Only admin users for admin-only channel
        await ChannelMember.addMember(channel._id, adminUser._id, 'admin');
        await ChannelMember.addMember(channel._id, modUser._id, 'moderator');
      } else {
        // Add all users to public channels
        await ChannelMember.addMember(channel._id, adminUser._id, 'admin');
        await ChannelMember.addMember(channel._id, modUser._id, 'moderator');
        
        for (const user of savedUsers) {
          await ChannelMember.addMember(channel._id, user._id, 'member');
        }
      }
    }
    
    // Create sample messages
    const sampleMessages = [
      {
        channel_id: savedChannels[0]._id, // general
        user_id: adminUser._id,
        content: 'Welcome to the general channel! Feel free to introduce yourself.',
        message_type: 'system',
        metadata: {
          ip_address: '127.0.0.1',
          user_agent: 'Migration Script',
          location: 'localhost'
        }
      },
      {
        channel_id: savedChannels[0]._id,
        user_id: savedUsers[0]._id,
        content: 'Hi everyone! I\'m John, excited to be here!',
        metadata: {
          ip_address: '127.0.0.1',
          user_agent: 'Migration Script',
          location: 'localhost'
        }
      },
      {
        channel_id: savedChannels[0]._id,
        user_id: savedUsers[1]._id,
        content: 'Hello! I\'m Jane, nice to meet you all!',
        metadata: {
          ip_address: '127.0.0.1',
          user_agent: 'Migration Script',
          location: 'localhost'
        }
      },
      {
        channel_id: savedChannels[1]._id, // random
        user_id: modUser._id,
        content: 'Welcome to the random channel! Share anything interesting here.',
        metadata: {
          ip_address: '127.0.0.1',
          user_agent: 'Migration Script',
          location: 'localhost'
        }
      },
      {
        channel_id: savedChannels[2]._id, // help
        user_id: adminUser._id,
        content: 'Need help? Post your questions here and we\'ll do our best to assist you!',
        metadata: {
          ip_address: '127.0.0.1',
          user_agent: 'Migration Script',
          location: 'localhost'
        }
      }
    ];
    
    const savedMessages = await Message.insertMany(sampleMessages);
    console.log('Sample messages created:', savedMessages.length);
    
    console.log('Sample data created successfully!');
    console.log('\nDefault login credentials:');
    console.log('Admin: admin@chatapp.com / admin123');
    console.log('Moderator: mod@chatapp.com / mod123');
    console.log('Users: john@example.com / user123, jane@example.com / user456, bob@example.com / user789');
    
  } catch (error) {
    console.error('Error creating sample data:', error);
  }
};

// Main migration function
const runMigration = async () => {
  try {
    await connectDB();
    await createIndexes();
    await createSampleData();
    
    console.log('\nMigration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

// Run migration if called directly
if (require.main === module) {
  runMigration();
}

module.exports = {
  connectDB,
  createIndexes,
  createSampleData,
  runMigration
};
