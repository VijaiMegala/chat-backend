const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Chat Application API',
      version: '1.0.0',
      description: 'A real-time chat application backend API with WebSocket support, user management, channel management, and messaging capabilities',
      contact: {
        name: 'API Support',
        email: 'support@chatapp.com'
      },
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'https://api.chatapp.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'User unique identifier' },
            username: { type: 'string', description: 'Username' },
            email: { type: 'string', description: 'User email address' },
            role: { 
              type: 'string', 
              enum: ['user', 'moderator', 'admin'],
              description: 'User role in the system'
            },
            is_online: { type: 'boolean', description: 'User online status' },
            last_seen: { type: 'string', format: 'date-time', description: 'Last activity timestamp' },
            avatar: { type: 'string', description: 'Profile picture URL' },
            created_at: { type: 'string', format: 'date-time', description: 'Account creation date' },
            updated_at: { type: 'string', format: 'date-time', description: 'Last update date' },
            banned_until: { type: 'string', format: 'date-time', description: 'Ban expiration date' },
            is_deleted: { type: 'boolean', description: 'Whether user account is deleted' }
          }
        },
        Channel: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Channel unique identifier' },
            name: { type: 'string', description: 'Channel name' },
            description: { type: 'string', description: 'Channel description' },
            is_private: { type: 'boolean', description: 'Whether channel is private' },
            created_by: { 
              type: 'object', 
              properties: {
                id: { type: 'string' },
                username: { type: 'string' },
                avatar: { type: 'string' }
              },
              description: 'Creator user information'
            },
            member_count: { type: 'number', description: 'Number of channel members' },
            created_at: { type: 'string', format: 'date-time', description: 'Channel creation date' },
            updated_at: { type: 'string', format: 'date-time', description: 'Last update date' }
          }
        },
        ChannelMember: {
          type: 'object',
          properties: {
            channel_id: { type: 'string', description: 'Channel ID' },
            user_id: { type: 'string', description: 'User ID' },
            role: { 
              type: 'string', 
              enum: ['member', 'moderator', 'admin'],
              description: 'User role in the channel'
            },
            joined_at: { type: 'string', format: 'date-time', description: 'Join date' },
            invited_by: { type: 'string', description: 'User who invited this member' },
            is_active: { type: 'boolean', description: 'Whether membership is active' },
            last_activity: { type: 'string', format: 'date-time', description: 'Last activity in channel' }
          }
        },
        Message: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Message unique identifier' },
            channel_id: { type: 'string', description: 'Channel ID where message was sent' },
            user_id: { 
              type: 'object', 
              properties: {
                id: { type: 'string' },
                username: { type: 'string' },
                avatar: { type: 'string' }
              },
              description: 'Sender user information'
            },
            content: { type: 'string', description: 'Message content' },
            message_type: { 
              type: 'string', 
              enum: ['text', 'image', 'file', 'system'],
              description: 'Type of message'
            },
            is_flagged: { type: 'boolean', description: 'Whether message is flagged' },
            flag_reason: { 
              type: 'string', 
              enum: ['inappropriate', 'spam', 'harassment', 'other'],
              description: 'Reason for flagging'
            },
            is_deleted: { type: 'boolean', description: 'Whether message is deleted' },
            reply_to: { 
              type: 'object', 
              properties: {
                id: { type: 'string' },
                content: { type: 'string' },
                user_id: { type: 'string' }
              },
              description: 'Information about the message being replied to'
            },
            attachments: { 
              type: 'array', 
              items: { 
                type: 'object',
                properties: {
                  filename: { type: 'string' },
                  original_name: { type: 'string' },
                  mime_type: { type: 'string' },
                  size: { type: 'number' },
                  url: { type: 'string' }
                }
              },
              description: 'File attachments'
            },
            metadata: {
              type: 'object',
              properties: {
                ip_address: { type: 'string' },
                user_agent: { type: 'string' },
                location: { type: 'string' }
              }
            },
            created_at: { type: 'string', format: 'date-time', description: 'Message creation date' },
            updated_at: { type: 'string', format: 'date-time', description: 'Last update date' }
          }
        },
        AuthResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', description: 'Authentication success status' },
            token: { type: 'string', description: 'JWT authentication token' },
            user: { $ref: '#/components/schemas/User' },
            message: { type: 'string', description: 'Response message' }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', description: 'User email address' },
            password: { type: 'string', description: 'User password' }
          }
        },
        RegisterRequest: {
          type: 'object',
          required: ['username', 'email', 'password'],
          properties: {
            username: { type: 'string', minLength: 3, maxLength: 30, description: 'Username (3-30 characters)' },
            email: { type: 'string', format: 'email', description: 'User email address' },
            password: { type: 'string', minLength: 6, description: 'Password (minimum 6 characters)' }
          }
        },
        ChannelCreationRequest: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100, description: 'Channel name' },
            description: { type: 'string', maxLength: 500, description: 'Channel description (optional)' },
            isPrivate: { type: 'boolean', default: false, description: 'Whether the channel is private' }
          }
        },
        MessageRequest: {
          type: 'object',
          required: ['content'],
          properties: {
            content: { type: 'string', minLength: 1, maxLength: 2000, description: 'Message content' },
            reply_to: { type: 'string', description: 'ID of message to reply to (optional)' },
            message_type: { type: 'string', enum: ['text', 'image', 'file'], default: 'text', description: 'Type of message' }
          }
        },
        ProfileUpdateRequest: {
          type: 'object',
          properties: {
            username: { type: 'string', minLength: 3, maxLength: 30, description: 'New username' },
            email: { type: 'string', format: 'email', description: 'New email address' },
            avatar: { type: 'string', description: 'Profile picture URL' }
          }
        },
        PasswordChangeRequest: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: { type: 'string', description: 'Current password' },
            newPassword: { type: 'string', minLength: 6, description: 'New password (minimum 6 characters)' }
          }
        },
        BanUserRequest: {
          type: 'object',
          required: ['banned_until'],
          properties: {
            banned_until: { type: 'string', format: 'date-time', description: 'Ban expiration date' },
            reason: { type: 'string', description: 'Reason for banning' }
          }
        },
        RoleUpdateRequest: {
          type: 'object',
          required: ['role'],
          properties: {
            role: { type: 'string', enum: ['user', 'moderator', 'admin'], description: 'New user role' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', description: 'Error message' },
            stack: { type: 'string', description: 'Error stack trace (development only)' }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', description: 'Success message' },
            data: { type: 'object', description: 'Response data' }
          }
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'number', description: 'Current page number' },
            limit: { type: 'number', description: 'Items per page' },
            total: { type: 'number', description: 'Total number of items' },
            pages: { type: 'number', description: 'Total number of pages' }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/routes/*.js', './src/models/*.js']
};

const specs = swaggerJsdoc(options);

module.exports = specs;
