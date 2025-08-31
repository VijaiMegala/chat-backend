# WebSocket API Documentation

This document describes all the WebSocket events available in the chat application. All events use JWT authentication via the `auth.token` field in the socket handshake.

## Authentication

Connect to the WebSocket with authentication:
```javascript
const socket = io('ws://localhost:3000', {
  auth: {
    token: 'your-jwt-token-here'
  }
});
```

## Connection Events

### `connect`
Emitted when successfully connected and authenticated.

### `disconnect`
Emitted when disconnected.

### `error`
Emitted when an error occurs:
```javascript
{
  message: "Error description"
}
```

## User Status Events

### `user_online`
Emitted when a user comes online:
```javascript
{
  userId: "user_id",
  username: "username",
  timestamp: "2024-01-01T00:00:00.000Z"
}
```

### `user_offline`
Emitted when a user goes offline:
```javascript
{
  userId: "user_id",
  username: "username",
  timestamp: "2024-01-01T00:00:00.000Z"
}
```

### `user_status_updated`
Emitted when a user updates their status:
```javascript
{
  userId: "user_id",
  username: "username",
  status: "status",
  timestamp: "2024-01-01T00:00:00.000Z"
}
```

## Channel Events

### `join_channel`
Join a channel:
```javascript
// Emit
socket.emit('join_channel', {
  channelId: "channel_id"
});

// Listen for success
socket.on('channel_joined', (data) => {
  console.log('Joined channel:', data.channelId);
});

// Listen for errors
socket.on('error', (error) => {
  console.error('Error:', error.message);
});
```

### `leave_channel`
Leave a channel:
```javascript
// Emit
socket.emit('leave_channel', {
  channelId: "channel_id"
});

// Listen for success
socket.on('channel_left', (data) => {
  console.log('Left channel:', data.channelId);
});
```

### `create_channel`
Create a new channel (admin/moderator only):
```javascript
// Emit
socket.emit('create_channel', {
  name: "Channel Name",
  description: "Channel description",
  isPrivate: false,
  members: ["user_id_1", "user_id_2"]
});

// Listen for success
socket.on('channel_created', (data) => {
  console.log('Channel created:', data.channel);
});

// Listen for public channel creation (other users)
socket.on('public_channel_created', (data) => {
  console.log('New public channel:', data.channel);
});
```

### `update_channel`
Update channel details (admin/moderator only):
```javascript
// Emit
socket.emit('update_channel', {
  channelId: "channel_id",
  updates: {
    name: "New Name",
    description: "New description"
  }
});

// Listen for channel updates
socket.on('channel_updated', (data) => {
  console.log('Channel updated:', data.channel);
});
```

### `delete_channel`
Delete a channel (admin only):
```javascript
// Emit
socket.emit('delete_channel', {
  channelId: "channel_id"
});

// Listen for channel deletion
socket.on('channel_deleted', (data) => {
  console.log('Channel deleted:', data.channelId);
});
```

### `add_channel_member`
Add a member to a channel (admin/moderator only):
```javascript
// Emit
socket.emit('add_channel_member', {
  channelId: "channel_id",
  userId: "user_id"
});

// Listen for member added
socket.on('member_added', (data) => {
  console.log('Member added:', data.userId);
});

// Listen if you're the added member
socket.on('added_to_channel', (data) => {
  console.log('Added to channel:', data.channel);
});
```

### `remove_channel_member`
Remove a member from a channel (admin/moderator only):
```javascript
// Emit
socket.emit('remove_channel_member', {
  channelId: "channel_id",
  userId: "user_id"
});

// Listen for member removed
socket.on('member_removed', (data) => {
  console.log('Member removed:', data.userId);
});

// Listen if you're the removed member
socket.on('removed_from_channel', (data) => {
  console.log('Removed from channel:', data.channelId);
});
```

## Message Events

### `new_message`
Send a new message:
```javascript
// Emit
socket.emit('new_message', {
  channelId: "channel_id",
  content: "Message content",
  replyTo: "message_id_to_reply_to" // optional
});

// Listen for new messages
socket.on('message_received', (data) => {
  console.log('New message:', data.message);
});
```

### `update_message`
Update a message (author only, within 5 minutes):
```javascript
// Emit
socket.emit('update_message', {
  messageId: "message_id",
  content: "Updated content"
});

// Listen for message updates
socket.on('message_updated', (data) => {
  console.log('Message updated:', data.message);
});
```

### `delete_message`
Delete a message (author or moderator):
```javascript
// Emit
socket.emit('delete_message', {
  messageId: "message_id"
});

// Listen for message deletion
socket.on('message_deleted', (data) => {
  console.log('Message deleted:', data.messageId);
});
```

### `flag_message`
Flag a message as inappropriate:
```javascript
// Emit
socket.emit('flag_message', {
  messageId: "message_id",
  reason: "inappropriate" // "inappropriate", "spam", "harassment", "other"
});

// Listen for success
socket.on('message_flagged_success', (data) => {
  console.log('Message flagged:', data.message);
});

// Listen for flagged messages (moderators only)
socket.on('message_flagged', (data) => {
  console.log('Message flagged:', data.message);
});
```

### `unflag_message`
Unflag a message (moderator only):
```javascript
// Emit
socket.emit('unflag_message', {
  messageId: "message_id"
});

// Listen for success
socket.on('message_unflagged_success', (data) => {
  console.log('Message unflagged:', data.message);
});

// Listen for unflagged messages (moderators only)
socket.on('message_unflagged', (data) => {
  console.log('Message unflagged:', data.message);
});
```

### `search_messages`
Search messages in a channel:
```javascript
// Emit
socket.emit('search_messages', {
  channelId: "channel_id",
  query: "search term",
  page: 1,
  limit: 50
});

// Listen for search results
socket.on('search_results', (data) => {
  console.log('Search results:', data.messages);
  console.log('Pagination:', data.pagination);
});
```

### `get_message_history`
Get message history for a channel:
```javascript
// Emit
socket.emit('get_message_history', {
  channelId: "channel_id",
  page: 1,
  limit: 50
});

// Listen for message history
socket.on('message_history', (data) => {
  console.log('Message history:', data.messages);
  console.log('Pagination:', data.pagination);
});
```

## Typing Indicators

### `typing_start`
Start typing indicator:
```javascript
// Emit
socket.emit('typing_start', {
  channelId: "channel_id"
});

// Listen for typing indicators
socket.on('user_typing', (data) => {
  console.log('User typing:', data.username);
});
```

### `typing_stop`
Stop typing indicator:
```javascript
// Emit
socket.emit('typing_stop', {
  channelId: "channel_id"
});

// Listen for typing stop
socket.on('user_stopped_typing', (data) => {
  console.log('User stopped typing:', data.username);
});
```

## Message Delivery Events

### `message_delivered`
Confirm message delivery:
```javascript
// Emit
socket.emit('message_delivered', {
  messageId: "message_id",
  channelId: "channel_id"
});

// Listen for delivery confirmations
socket.on('message_delivered', (data) => {
  console.log('Message delivered to:', data.deliveredTo);
});
```

### `message_read`
Confirm message read:
```javascript
// Emit
socket.emit('message_read', {
  messageId: "message_id",
  channelId: "channel_id"
});

// Listen for read confirmations
socket.on('message_read', (data) => {
  console.log('Message read by:', data.readBy);
});
```

## User Management Events

### `user_joined_channel`
Emitted when a user joins a channel:
```javascript
{
  userId: "user_id",
  username: "username",
  channelId: "channel_id",
  timestamp: "2024-01-01T00:00:00.000Z"
}
```

### `user_left_channel`
Emitted when a user leaves a channel:
```javascript
{
  userId: "user_id",
  username: "username",
  channelId: "channel_id",
  timestamp: "2024-01-01T00:00:00.000Z"
}
```

## Error Handling

All events can emit errors. Always listen for the `error` event:
```javascript
socket.on('error', (error) => {
  console.error('WebSocket error:', error.message);
  // Handle error appropriately
});
```

## Best Practices

1. **Always handle errors** - Listen for the `error` event on every socket
2. **Validate data** - Ensure required fields are present before emitting events
3. **Handle disconnections** - Implement reconnection logic
4. **Rate limiting** - Don't spam events, especially typing indicators
5. **Authentication** - Ensure valid JWT token is provided
6. **Channel membership** - Verify user has access to channels before operations

## Example Client Implementation

```javascript
class ChatClient {
  constructor(token) {
    this.socket = io('ws://localhost:3000', {
      auth: { token }
    });
    
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('Connected to chat server');
    });
    
    this.socket.on('disconnect', () => {
      console.log('Disconnected from chat server');
    });
    
    this.socket.on('error', (error) => {
      console.error('Chat error:', error.message);
    });
    
    // Message events
    this.socket.on('message_received', (data) => {
      this.handleNewMessage(data.message);
    });
    
    this.socket.on('message_updated', (data) => {
      this.handleMessageUpdate(data.message);
    });
    
    this.socket.on('message_deleted', (data) => {
      this.handleMessageDelete(data.messageId);
    });
    
    // Channel events
    this.socket.on('channel_updated', (data) => {
      this.handleChannelUpdate(data.channel);
    });
    
    this.socket.on('channel_deleted', (data) => {
      this.handleChannelDelete(data.channelId);
    });
  }
  
  sendMessage(channelId, content, replyTo = null) {
    this.socket.emit('new_message', {
      channelId,
      content,
      replyTo
    });
  }
  
  joinChannel(channelId) {
    this.socket.emit('join_channel', { channelId });
  }
  
  leaveChannel(channelId) {
    this.socket.emit('leave_channel', { channelId });
  }
  
  // ... other methods
}
```
