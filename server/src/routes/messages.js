const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

// Get all conversations for current user
router.get('/conversations', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch conversation summaries
    const convs = db.prepare(`
      SELECT 
        c.id, c.is_group as isGroup, c.name, c.created_at as createdAt, c.updated_at as updatedAt,
        cp.last_read_at as myLastReadAt
      FROM conversations c
      JOIN conversation_participants cp ON c.id = cp.conversation_id
      WHERE cp.user_id = ?
      ORDER BY c.updated_at DESC
    `).all(userId);

    const conversations = convs.map(c => {
      // Get other participants
      const participants = db.prepare(`
        SELECT u.id, u.display_name as displayName, u.avatar, u.title, u.status
        FROM conversation_participants cp
        JOIN users u ON cp.user_id = u.id
        WHERE cp.conversation_id = ?
      `).all(c.id);

      // Other participant for 1-on-1
      const otherParticipant = participants.find(p => p.id !== userId) || participants[0];

      // Get latest message
      const lastMessage = db.prepare(`
        SELECT m.id, m.sender_id as senderId, m.message_type as messageType, m.content, m.created_at as createdAt, m.is_deleted as isDeleted
        FROM messages m
        WHERE m.conversation_id = ?
        ORDER BY m.created_at DESC LIMIT 1
      `).get(c.id);

      // Unread count
      const unread = db.prepare(`
        SELECT COUNT(*) as count
        FROM messages m
        WHERE m.conversation_id = ? 
          AND m.sender_id != ? 
          AND m.created_at > ?
      `).get(c.id, userId, c.myLastReadAt || '1970-01-01');

      return {
        id: c.id,
        isGroup: !!c.isGroup,
        name: c.isGroup ? c.name : (otherParticipant ? otherParticipant.displayName : 'Conversation'),
        otherParticipant,
        participants,
        lastMessage: lastMessage ? {
          ...lastMessage,
          content: lastMessage.isDeleted ? 'This message was deleted' : lastMessage.content
        } : null,
        unreadCount: unread ? unread.count : 0,
        updatedAt: c.updatedAt
      };
    });

    res.json({ conversations });
  } catch (err) {
    console.error('Get conversations error:', err);
    res.status(500).json({ error: 'Failed to retrieve conversations' });
  }
});

// Get or create direct conversation with another user
router.post('/conversations/direct', authenticateToken, (req, res) => {
  try {
    const { targetUserId } = req.body;
    const userId = req.user.id;

    if (!targetUserId) {
      return res.status(400).json({ error: 'targetUserId is required' });
    }
    if (targetUserId === userId) {
      return res.status(400).json({ error: 'Cannot start conversation with yourself' });
    }

    // Check if 1-on-1 conversation already exists
    const existing = db.prepare(`
      SELECT cp1.conversation_id as id
      FROM conversation_participants cp1
      JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
      JOIN conversations c ON c.id = cp1.conversation_id
      WHERE cp1.user_id = ? AND cp2.user_id = ? AND c.is_group = 0
    `).get(userId, targetUserId);

    if (existing) {
      return res.json({ conversationId: existing.id });
    }

    // Create new conversation
    const newConvId = 'conv_' + uuidv4().substring(0, 10);
    const createConv = db.transaction(() => {
      db.prepare(`
        INSERT INTO conversations (id, is_group, name, created_at, updated_at)
        VALUES (?, 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(newConvId);

      db.prepare(`
        INSERT INTO conversation_participants (conversation_id, user_id, joined_at, last_read_at)
        VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP), (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(newConvId, userId, newConvId, targetUserId);
    });

    createConv();

    res.status(201).json({ conversationId: newConvId });
  } catch (err) {
    console.error('Create direct conversation error:', err);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Get messages in a conversation
router.get('/conversations/:id/messages', authenticateToken, (req, res) => {
  try {
    const convId = req.params.id;
    const userId = req.user.id;

    // Check membership
    const isMember = db.prepare(`
      SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?
    `).get(convId, userId);

    if (!isMember) {
      return res.status(403).json({ error: 'Not authorized to view this conversation' });
    }

    const messages = db.prepare(`
      SELECT 
        m.id, m.conversation_id as conversationId, m.sender_id as senderId,
        m.message_type as messageType, m.content, m.file_id as fileId,
        m.reply_to_id as replyToId, m.status as status, m.is_edited as isEdited, m.is_deleted as isDeleted,
        m.created_at as createdAt, m.updated_at as updatedAt,
        u.display_name as senderDisplayName, u.avatar as senderAvatar,
        f.original_name as fileOriginalName, f.filename as fileSavedName, f.mimetype as fileMimeType,
        f.size as fileSize, f.file_type as fileCategory, f.duration_seconds as fileDuration,
        rep.content as replyContent, rep_user.display_name as replySenderName
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      LEFT JOIN files f ON m.file_id = f.id
      LEFT JOIN messages rep ON m.reply_to_id = rep.id
      LEFT JOIN users rep_user ON rep.sender_id = rep_user.id
      WHERE m.conversation_id = ?
      ORDER BY m.created_at ASC
    `).all(convId);

    // Format safe messages
    const formatted = messages.map(m => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      senderDisplayName: m.senderDisplayName,
      senderAvatar: m.senderAvatar,
      messageType: m.messageType,
      content: m.isDeleted ? 'This message was deleted' : m.content,
      status: m.status || 'sent',
      isEdited: !!m.isEdited,
      isDeleted: !!m.isDeleted,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      file: m.fileId ? {
        id: m.fileId,
        originalName: m.fileOriginalName,
        filename: m.fileSavedName,
        mimetype: m.fileMimeType,
        size: m.fileSize,
        category: m.fileCategory,
        duration: m.fileDuration,
        url: `/api/files/${m.fileId}/download`
      } : null,
      replyTo: m.replyToId ? {
        id: m.replyToId,
        senderName: m.replySenderName,
        content: m.replyContent
      } : null
    }));

    res.json({ messages: formatted });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Failed to retrieve messages' });
  }
});

// Send message
router.post('/conversations/:id/messages', authenticateToken, (req, res) => {
  try {
    const convId = req.params.id;
    const userId = req.user.id;
    const { content, messageType = 'text', fileId, replyToId } = req.body;

    if (!content && !fileId) {
      return res.status(400).json({ error: 'Message content or attachment required' });
    }

    // Verify membership
    const isMember = db.prepare(`
      SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?
    `).get(convId, userId);

    if (!isMember) {
      return res.status(403).json({ error: 'Not authorized to send messages in this conversation' });
    }

    const messageId = 'msg_' + uuidv4().substring(0, 10);

    const insertMsg = db.transaction(() => {
      db.prepare(`
        INSERT INTO messages (id, conversation_id, sender_id, message_type, content, file_id, reply_to_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(messageId, convId, userId, messageType, content || '', fileId || null, replyToId || null);

      db.prepare(`
        UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(convId);

      // Update current user's read timestamp
      db.prepare(`
        UPDATE conversation_participants SET last_read_at = CURRENT_TIMESTAMP WHERE conversation_id = ? AND user_id = ?
      `).run(convId, userId);
    });

    insertMsg();

    // Fetch newly created message
    const msg = db.prepare(`
      SELECT 
        m.id, m.conversation_id as conversationId, m.sender_id as senderId,
        m.message_type as messageType, m.content, m.file_id as fileId,
        m.reply_to_id as replyToId, m.status as status, m.is_edited as isEdited, m.is_deleted as isDeleted,
        m.created_at as createdAt, m.updated_at as updatedAt,
        u.display_name as senderDisplayName, u.avatar as senderAvatar,
        f.original_name as fileOriginalName, f.filename as fileSavedName, f.mimetype as fileMimeType,
        f.size as fileSize, f.file_type as fileCategory, f.duration_seconds as fileDuration
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      LEFT JOIN files f ON m.file_id = f.id
      WHERE m.id = ?
    `).get(messageId);

    const formatted = {
      id: msg.id,
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      senderDisplayName: msg.senderDisplayName,
      senderAvatar: msg.senderAvatar,
      messageType: msg.messageType,
      content: msg.content,
      status: msg.status || 'sent',
      isEdited: false,
      isDeleted: false,
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
      file: msg.fileId ? {
        id: msg.fileId,
        originalName: msg.fileOriginalName,
        filename: msg.fileSavedName,
        mimetype: msg.fileMimeType,
        size: msg.fileSize,
        category: msg.fileCategory,
        duration: msg.fileDuration,
        url: `/api/files/${msg.fileId}/download`
      } : null,
      replyToId: msg.replyToId
    };

    res.status(201).json({ message: formatted });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Mark conversation as read (explicitly when viewed)
router.post('/conversations/:id/read', authenticateToken, (req, res) => {
  try {
    const convId = req.params.id;
    const userId = req.user.id;

    db.transaction(() => {
      // Update participant read timestamp
      db.prepare(`
        UPDATE conversation_participants SET last_read_at = CURRENT_TIMESTAMP WHERE conversation_id = ? AND user_id = ?
      `).run(convId, userId);

      // Update incoming messages to 'read'
      db.prepare(`
        UPDATE messages SET status = 'read' WHERE conversation_id = ? AND sender_id != ? AND status != 'read'
      `).run(convId, userId);
    })();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// Edit message
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { content } = req.body;
    const messageId = req.params.id;
    const userId = req.user.id;

    const msg = db.prepare('SELECT sender_id, is_deleted FROM messages WHERE id = ?').get(messageId);
    if (!msg) {
      return res.status(404).json({ error: 'Message not found' });
    }
    if (msg.sender_id !== userId) {
      return res.status(403).json({ error: 'You can only edit your own messages' });
    }
    if (msg.is_deleted) {
      return res.status(400).json({ error: 'Cannot edit deleted message' });
    }

    db.prepare(`
      UPDATE messages SET content = ?, is_edited = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(content, messageId);

    res.json({ success: true, messageId, content });
  } catch (err) {
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

// Delete message
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const messageId = req.params.id;
    const userId = req.user.id;

    const msg = db.prepare('SELECT sender_id FROM messages WHERE id = ?').get(messageId);
    if (!msg) {
      return res.status(404).json({ error: 'Message not found' });
    }
    if (msg.sender_id !== userId) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }

    db.prepare(`
      UPDATE messages SET is_deleted = 1, content = 'This message was deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(messageId);

    res.json({ success: true, messageId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

module.exports = router;
