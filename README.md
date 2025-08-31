# Chat Application Backend

A real-time chat application backend built with Express.js, MongoDB, and Socket.IO, featuring user authentication, channel management, real-time messaging, and content moderation.

## Features

- **User Authentication**: JWT-based authentication with user registration and login
- **Channel Management**: Create, join, and manage public/private channels
- **Real-time Messaging**: WebSocket-based live messaging with typing indicators
- **Content Moderation**: Profanity filtering and spam prevention
- **User Management**: Role-based access control (User, Moderator, Admin)
- **Message Features**: Reply to messages, flag inappropriate content, search messages
- **Online Status**: Real-time user online/offline status updates
- **Rate Limiting**: API rate limiting to prevent abuse

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Real-time**: Socket.IO
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: Joi
- **Security**: bcryptjs, helmet, CORS
- **Content Moderation**: bad-words library

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd chat-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` file with your configuration:
   ```env
   NODE_ENV=development
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/chat_app
   JWT_SECRET=your-super-secret-jwt-key
   JWT_EXPIRES_IN=7d
   ```

4. **Database Setup**
   ```bash
   npm run migrate
   ```

5. **Start the server**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/refresh` | Refresh JWT token |
| POST | `/api/auth/logout` | User logout |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/profile` | Get current user profile |
| PUT | `/api/users/profile` | Update user profile |
| PUT | `/api/users/password` | Change password |
| GET | `/api/users` | Get all users (Moderator+) |
| GET | `/api/users/:id` | Get user by ID (Moderator+) |
| PUT | `/api/users/:id/ban` | Ban user (Moderator+) |
| PUT | `/api/users/:id/unban` | Unban user (Moderator+) |
| PUT | `/api/users/:id/role` | Change user role (Admin) |
| DELETE | `/api/users/:id` | Delete user (Admin) |

### Channels

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/channels` | Create new channel |
| GET | `/api/channels` | List user's channels |
| GET | `/api/channels/public` | List public channels |
| GET | `/api/channels/:id` | Get channel details |
| POST | `/api/channels/:id/join` | Join a channel |
| DELETE | `/api/channels/:id/leave` | Leave a channel |
| GET | `/api/channels/:id/members` | Get channel members |
| PUT | `/api/channels/:id/settings` | Update channel settings (Moderator+) |
| DELETE | `/api/channels/:id` | Delete channel (Admin) |

### Messages

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/messages/channel/:id` | Get channel messages |
| POST | `/api/messages/channel/:id` | Send message to channel |
| GET | `/api/messages/:id` | Get message by ID |
| PUT | `/api/messages/:id` | Update message (author only) |
| DELETE | `/api/messages/:id` | Delete message (author/moderator) |
| PUT | `/api/messages/:id/flag` | Flag message |
| PUT | `/api/messages/:id/unflag` | Unflag message (Moderator+) |
| GET | `/api/messages/flagged/all` | Get flagged messages (Moderator+) |
| GET | `/api/messages/search/:channelId` | Search messages in channel |

## WebSocket Events

### Client to Server

- `join_channel`: Join a channel
- `leave_channel`: Leave a channel
- `typing_start`: Start typing indicator
- `typing_stop`: Stop typing indicator
- `new_message`: Send new message
- `message_delivered`: Confirm message delivery
- `message_read`: Confirm message read
- `status_update`: Update user status

### Server to Client

- `user_online`: User came online
- `user_offline`: User went offline
- `user_joined_channel`: User joined channel
- `user_left_channel`: User left channel
- `user_typing`: User started typing
- `user_stopped_typing`: User stopped typing
- `message_received`: New message received
- `message_delivered`: Message delivery confirmation
- `message_read`: Message read confirmation
- `user_status_updated`: User status updated

## Database Schema

### Users
- `id`: Unique identifier
- `username`: Unique username
- `email`: Unique email address
- `password`: Hashed password
- `role`: User role (user, moderator, admin)
- `banned_until`: Ban expiration date
- `is_online`: Online status
- `last_seen`: Last activity timestamp
- `avatar`: Profile picture URL
- `created_at`: Account creation date
- `updated_at`: Last update date

### Channels
- `id`: Unique identifier
- `name`: Channel name
- `description`: Channel description
- `is_private`: Private channel flag
- `created_by`: Creator user ID
- `members`: Array of channel members with roles
- `settings`: Channel-specific settings
- `created_at`: Channel creation date
- `updated_at`: Last update date

### Messages
- `id`: Unique identifier
- `channel_id`: Channel ID
- `user_id`: Sender user ID
- `content`: Message content
- `message_type`: Message type (text, image, file, system)
- `is_flagged`: Flagged status
- `flag_reason`: Reason for flagging
- `is_deleted`: Deletion status
- `reply_to`: Reply message ID
- `attachments`: File attachments
- `metadata`: Additional message metadata
- `created_at`: Message creation date
- `updated_at`: Last update date

## Content Moderation

The application includes several content moderation features:

- **Profanity Filtering**: Automatic detection and blocking of inappropriate content
- **Spam Prevention**: Rate limiting and duplicate message detection
- **Content Length Validation**: Maximum message length enforcement
- **URL Validation**: Limit on number of URLs per message
- **Message Flagging**: User reporting system for inappropriate content

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcryptjs for secure password storage
- **Rate Limiting**: API rate limiting to prevent abuse
- **CORS Protection**: Cross-origin resource sharing configuration
- **Helmet Security**: Security headers middleware
- **Input Validation**: Request validation using Joi
- **Role-based Access Control**: Different permission levels for users

## Development

### Project Structure
```
chat-backend/
├── src/
│   ├── models/          # MongoDB models
│   ├── routes/          # API route handlers
│   ├── middleware/      # Custom middleware
│   ├── websocket/       # WebSocket implementation
│   └── server.js        # Main server file
├── scripts/
│   └── migrate.js       # Database migration script
├── package.json
├── env.example
└── README.md
```

### Available Scripts

- `npm start`: Start production server
- `npm run dev`: Start development server with nodemon
- `npm run migrate`: Run database migration
- `npm test`: Run tests

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/chat_app` |
| `MONGODB_URI_PROD` | Production MongoDB URI | - |
| `JWT_SECRET` | JWT signing secret | - |
| `JWT_EXPIRES_IN` | JWT expiration time | `7d` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `900000` (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |
| `PROFANITY_FILTER_ENABLED` | Enable profanity filter | `true` |
| `SPAM_PREVENTION_ENABLED` | Enable spam prevention | `true` |

## Testing

```bash
npm test
```

## Deployment

1. Set environment variables for production
2. Ensure MongoDB is accessible
3. Run database migration: `npm run migrate`
4. Start the server: `npm start`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the ISC License.

## Support

For support and questions, please open an issue in the repository.
