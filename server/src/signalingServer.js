const { WebSocketServer, WebSocket } = require('ws');
const jwt = require('jsonwebtoken');
const config = require('./config');
const db = require('./database');

function setupSignalingServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Map: userId -> Set<WebSocket> (support multiple tabs/devices)
  const connectedUsers = new Map();
  // Map: ws -> { userId, user }
  const socketData = new Map();
  // Map: meetingCode -> Map<userId, { ws, user }>
  const meetingRooms = new Map();
  // Map: callId -> { callerId, calleeId, status, callType, startedAt }
  const activeCalls = new Map();

  // Helper to send JSON safely
  function send(ws, type, payload = {}) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, ...payload }));
    }
  }

  // Helper to send to all sockets of a user
  function sendToUser(userId, type, payload = {}) {
    const sockets = connectedUsers.get(userId);
    if (sockets) {
      for (const ws of sockets) {
        send(ws, type, payload);
      }
      return true;
    }
    return false;
  }

  // Broadcast to all connected users
  function broadcast(type, payload = {}, excludeUserId = null) {
    for (const [uid, sockets] of connectedUsers.entries()) {
      if (excludeUserId && uid === excludeUserId) continue;
      for (const ws of sockets) {
        send(ws, type, payload);
      }
    }
  }

  // Get list of currently online user IDs
  function getOnlineUserIds() {
    return Array.from(connectedUsers.keys());
  }

  wss.on('connection', (ws, req) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (data) => {
      let message;
      try {
        message = JSON.parse(data.toString());
      } catch (err) {
        console.error('Invalid JSON received on websocket:', err);
        return;
      }

      const { type, payload } = message;
      const currentSocketUser = socketData.get(ws);

      switch (type) {
        // Authenticate & Bind socket
        case 'auth': {
          const { token } = payload || {};
          if (!token) {
            send(ws, 'auth-error', { message: 'Token required' });
            return;
          }

          try {
            const decoded = jwt.verify(token, config.JWT_SECRET);
            const user = db.prepare('SELECT id, email, display_name as displayName, avatar, title, status FROM users WHERE id = ?').get(decoded.userId);
            if (!user) {
              send(ws, 'auth-error', { message: 'User not found' });
              return;
            }

            // Register socket
            if (!connectedUsers.has(user.id)) {
              connectedUsers.set(user.id, new Set());
            }
            connectedUsers.get(user.id).add(ws);
            socketData.set(ws, { userId: user.id, user });

            // Update user status in database
            db.prepare("UPDATE users SET status = 'online', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(user.id);

            // Acknowledge auth
            send(ws, 'auth-success', {
              user,
              onlineUserIds: getOnlineUserIds()
            });

            // Mark any pending 'sent' messages addressed to this newly online user as 'delivered'
            try {
              const pendingConvs = db.prepare(`
                SELECT DISTINCT m.conversation_id as conversationId, m.sender_id as senderId, m.id as messageId
                FROM messages m
                JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
                WHERE cp.user_id = ? AND m.sender_id != ? AND m.status = 'sent'
              `).all(user.id, user.id);

              if (pendingConvs.length > 0) {
                db.prepare(`
                  UPDATE messages SET status = 'delivered'
                  WHERE id IN (${pendingConvs.map(() => '?').join(',')})
                `).run(...pendingConvs.map(p => p.messageId));

                for (const item of pendingConvs) {
                  sendToUser(item.senderId, 'message-status-updated', {
                    conversationId: item.conversationId,
                    messageId: item.messageId,
                    status: 'delivered'
                  });
                }
              }
            } catch (deliverErr) {
              console.error('Error delivering pending messages:', deliverErr);
            }

            // Notify everyone of user's online status
            broadcast('user-status-changed', {
              userId: user.id,
              status: 'online'
            }, user.id);

          } catch (err) {
            console.error('Signaling auth error:', err);
            send(ws, 'auth-error', { message: 'Invalid token' });
          }
          break;
        }

        // ==========================================
        // 1-ON-1 AUDIO / VIDEO CALL SIGNALING
        // ==========================================
        case 'call-request': {
          if (!currentSocketUser) return;
          const { targetUserId, callType, callId } = payload;

          const calleeSockets = connectedUsers.get(targetUserId);
          if (!calleeSockets || calleeSockets.size === 0) {
            send(ws, 'call-rejected', {
              callId,
              targetUserId,
              reason: 'User is currently offline'
            });
            return;
          }

          // Check if target is in an active call
          for (const [cId, activeCall] of activeCalls.entries()) {
            if ((activeCall.callerId === targetUserId || activeCall.calleeId === targetUserId) && activeCall.status === 'in-progress') {
              send(ws, 'call-rejected', {
                callId,
                targetUserId,
                reason: 'User is busy on another call'
              });
              return;
            }
          }

          activeCalls.set(callId, {
            callId,
            callerId: currentSocketUser.userId,
            calleeId: targetUserId,
            callType,
            status: 'ringing',
            startedAt: new Date().toISOString()
          });

          sendToUser(targetUserId, 'incoming-call', {
            callId,
            callType,
            caller: currentSocketUser.user
          });
          break;
        }

        case 'call-accept': {
          if (!currentSocketUser) return;
          const { callId, targetUserId } = payload;
          const call = activeCalls.get(callId);
          if (call) {
            call.status = 'in-progress';
          }

          sendToUser(targetUserId, 'call-accepted', {
            callId,
            responder: currentSocketUser.user
          });
          break;
        }

        case 'call-reject': {
          if (!currentSocketUser) return;
          const { callId, targetUserId, reason = 'Call declined' } = payload;
          activeCalls.delete(callId);

          // Log rejected call
          try {
            db.prepare(`
              INSERT INTO calls (id, caller_id, callee_id, call_type, status, started_at, ended_at, duration_seconds)
              VALUES (?, ?, ?, 'audio', 'rejected', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
            `).run(callId, targetUserId, currentSocketUser.userId);
          } catch (e) {}

          sendToUser(targetUserId, 'call-rejected', {
            callId,
            reason
          });
          break;
        }

        case 'call-offer': {
          if (!currentSocketUser) return;
          const { callId, targetUserId, sdp } = payload;
          sendToUser(targetUserId, 'call-offer', {
            callId,
            sdp,
            senderUserId: currentSocketUser.userId
          });
          break;
        }

        case 'call-answer': {
          if (!currentSocketUser) return;
          const { callId, targetUserId, sdp } = payload;
          sendToUser(targetUserId, 'call-answer', {
            callId,
            sdp,
            senderUserId: currentSocketUser.userId
          });
          break;
        }

        case 'call-ice-candidate': {
          if (!currentSocketUser) return;
          const { callId, targetUserId, candidate } = payload;
          sendToUser(targetUserId, 'call-ice-candidate', {
            callId,
            candidate,
            senderUserId: currentSocketUser.userId
          });
          break;
        }

        case 'call-screen-share': {
          if (!currentSocketUser) return;
          const { callId, targetUserId, isSharing } = payload;
          sendToUser(targetUserId, 'call-screen-share', {
            callId,
            isSharing,
            senderUserId: currentSocketUser.userId
          });
          break;
        }

        case 'call-end': {
          if (!currentSocketUser) return;
          const { callId, targetUserId, durationSeconds = 0, callType = 'audio' } = payload;
          const call = activeCalls.get(callId);
          activeCalls.delete(callId);

          // Log completed call in DB
          try {
            db.prepare(`
              INSERT INTO calls (id, caller_id, callee_id, call_type, status, started_at, ended_at, duration_seconds)
              VALUES (?, ?, ?, ?, 'completed', datetime('now', '-' || ? || ' seconds'), CURRENT_TIMESTAMP, ?)
            `).run(callId, currentSocketUser.userId, targetUserId, callType, durationSeconds, durationSeconds);
          } catch (e) {}

          sendToUser(targetUserId, 'call-ended', {
            callId,
            durationSeconds
          });
          break;
        }

        // ==========================================
        // MESH GROUP MEETING SIGNALING
        // ==========================================
        case 'join-meeting': {
          if (!currentSocketUser) return;
          const { meetingCode, userInfo } = payload;
          const code = meetingCode.trim().toLowerCase();

          if (!meetingRooms.has(code)) {
            meetingRooms.set(code, new Map());
          }
          const room = meetingRooms.get(code);

          // Check participant limit
          if (room.size >= config.MAX_MEETING_PARTICIPANTS) {
            send(ws, 'meeting-error', { message: `Meeting is full (maximum ${config.MAX_MEETING_PARTICIPANTS} participants in mesh)` });
            return;
          }

          // Existing participants to return to the joiner
          const existingParticipants = [];
          for (const [pId, pData] of room.entries()) {
            existingParticipants.push(pData.user);
          }

          // Add this user to room
          const participantInfo = userInfo || currentSocketUser.user;
          room.set(currentSocketUser.userId, { ws, user: participantInfo });

          // Record participant in database
          try {
            const meeting = db.prepare('SELECT id FROM meetings WHERE code = ?').get(code);
            if (meeting) {
              db.prepare(`
                INSERT OR IGNORE INTO meeting_participants (id, meeting_id, user_id, joined_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
              `).run(`mp_${code}_${currentSocketUser.userId}`, meeting.id, currentSocketUser.userId);
            }
          } catch (e) {}

          // Send list of current participants to the newly joined user
          send(ws, 'meeting-joined', {
            meetingCode: code,
            participants: existingParticipants
          });

          // Broadcast to everyone else in the room that a new peer joined
          for (const [pId, pData] of room.entries()) {
            if (pId !== currentSocketUser.userId) {
              send(pData.ws, 'meeting-user-joined', {
                user: participantInfo
              });
            }
          }
          break;
        }

        case 'meeting-offer': {
          if (!currentSocketUser) return;
          const { meetingCode, targetUserId, sdp } = payload;
          const code = meetingCode.trim().toLowerCase();
          const room = meetingRooms.get(code);
          if (room && room.has(targetUserId)) {
            send(room.get(targetUserId).ws, 'meeting-offer', {
              senderUserId: currentSocketUser.userId,
              senderUser: currentSocketUser.user,
              sdp
            });
          }
          break;
        }

        case 'meeting-answer': {
          if (!currentSocketUser) return;
          const { meetingCode, targetUserId, sdp } = payload;
          const code = meetingCode.trim().toLowerCase();
          const room = meetingRooms.get(code);
          if (room && room.has(targetUserId)) {
            send(room.get(targetUserId).ws, 'meeting-answer', {
              senderUserId: currentSocketUser.userId,
              sdp
            });
          }
          break;
        }

        case 'meeting-ice-candidate': {
          if (!currentSocketUser) return;
          const { meetingCode, targetUserId, candidate } = payload;
          const code = meetingCode.trim().toLowerCase();
          const room = meetingRooms.get(code);
          if (room && room.has(targetUserId)) {
            send(room.get(targetUserId).ws, 'meeting-ice-candidate', {
              senderUserId: currentSocketUser.userId,
              candidate
            });
          }
          break;
        }

        case 'meeting-track-state': {
          if (!currentSocketUser) return;
          const { meetingCode, audioMuted, videoMuted, isScreenSharing, isSpeaking } = payload;
          const code = meetingCode.trim().toLowerCase();
          const room = meetingRooms.get(code);
          if (room) {
            for (const [pId, pData] of room.entries()) {
              if (pId !== currentSocketUser.userId) {
                send(pData.ws, 'meeting-track-state-changed', {
                  userId: currentSocketUser.userId,
                  audioMuted,
                  videoMuted,
                  isScreenSharing,
                  isSpeaking
                });
              }
            }
          }
          break;
        }

        case 'meeting-recording-status': {
          if (!currentSocketUser) return;
          const { meetingCode, isRecording, startedBy } = payload;
          const code = meetingCode.trim().toLowerCase();
          const room = meetingRooms.get(code);
          if (room) {
            for (const [pId, pData] of room.entries()) {
              send(pData.ws, 'meeting-recording-state', {
                isRecording,
                startedBy
              });
            }
          }
          break;
        }

        case 'meeting-chat-message': {
          if (!currentSocketUser) return;
          const { meetingCode, messageText } = payload;
          const code = meetingCode.trim().toLowerCase();
          const room = meetingRooms.get(code);
          if (room) {
            const chatPayload = {
              sender: currentSocketUser.user,
              text: messageText,
              timestamp: new Date().toISOString()
            };
            for (const [pId, pData] of room.entries()) {
              send(pData.ws, 'meeting-chat-message', chatPayload);
            }
          }
          break;
        }

        case 'leave-meeting': {
          if (!currentSocketUser) return;
          const { meetingCode } = payload;
          const code = meetingCode.trim().toLowerCase();
          const room = meetingRooms.get(code);
          if (room) {
            room.delete(currentSocketUser.userId);
            for (const [pId, pData] of room.entries()) {
              send(pData.ws, 'meeting-user-left', {
                userId: currentSocketUser.userId
              });
            }
            if (room.size === 0) {
              meetingRooms.delete(code);
            }
          }
          break;
        }

        // ==========================================
        // REAL-TIME CHAT & TYPING
        // ==========================================
        case 'chat-message-sent': {
          if (!currentSocketUser) return;
          const { conversationId, targetUserIds, message } = payload;
          if (Array.isArray(targetUserIds)) {
            for (const targetId of targetUserIds) {
              if (targetId !== currentSocketUser.userId) {
                // Check if target is online (connected to websocket)
                const isOnline = connectedUsers.has(targetId) && connectedUsers.get(targetId).size > 0;
                const messageWithStatus = {
                  ...message,
                  status: isOnline ? 'delivered' : 'sent'
                };

                // Update database if delivered immediately
                if (isOnline) {
                  try {
                    db.prepare("UPDATE messages SET status = 'delivered' WHERE id = ? AND status = 'sent'").run(message.id);
                  } catch (e) {}
                  // Notify sender that message reached recipient device
                  sendToUser(currentSocketUser.userId, 'message-status-updated', {
                    conversationId,
                    messageId: message.id,
                    status: 'delivered'
                  });
                }

                sendToUser(targetId, 'new-chat-message', {
                  conversationId,
                  message: messageWithStatus
                });
              }
            }
          }
          break;
        }

        case 'chat-messages-read': {
          if (!currentSocketUser) return;
          const { conversationId, targetUserIds, messageIds } = payload;
          if (Array.isArray(targetUserIds)) {
            for (const targetId of targetUserIds) {
              if (targetId !== currentSocketUser.userId) {
                sendToUser(targetId, 'messages-read-receipt', {
                  conversationId,
                  readByUserId: currentSocketUser.userId,
                  messageIds
                });
              }
            }
          }
          break;
        }

        case 'chat-message-edited': {
          if (!currentSocketUser) return;
          const { conversationId, targetUserIds, messageId, content } = payload;
          if (Array.isArray(targetUserIds)) {
            for (const targetId of targetUserIds) {
              if (targetId !== currentSocketUser.userId) {
                sendToUser(targetId, 'chat-message-edited', {
                  conversationId,
                  messageId,
                  content
                });
              }
            }
          }
          break;
        }

        case 'chat-message-deleted': {
          if (!currentSocketUser) return;
          const { conversationId, targetUserIds, messageId } = payload;
          if (Array.isArray(targetUserIds)) {
            for (const targetId of targetUserIds) {
              if (targetId !== currentSocketUser.userId) {
                sendToUser(targetId, 'chat-message-deleted', {
                  conversationId,
                  messageId
                });
              }
            }
          }
          break;
        }

        case 'typing-indicator': {
          if (!currentSocketUser) return;
          const { conversationId, targetUserIds, isTyping } = payload;
          if (Array.isArray(targetUserIds)) {
            for (const targetId of targetUserIds) {
              if (targetId !== currentSocketUser.userId) {
                sendToUser(targetId, 'user-typing', {
                  conversationId,
                  userId: currentSocketUser.userId,
                  displayName: currentSocketUser.user.displayName,
                  isTyping
                });
              }
            }
          }
          break;
        }

        default:
          console.warn('Unhandled websocket message type:', type);
      }
    });

    ws.on('close', () => {
      const userMeta = socketData.get(ws);
      if (userMeta) {
        const { userId, user } = userMeta;
        socketData.delete(ws);

        // Remove socket from user's set
        const sockets = connectedUsers.get(userId);
        if (sockets) {
          sockets.delete(ws);
          if (sockets.size === 0) {
            connectedUsers.delete(userId);
            // Update database status
            db.prepare("UPDATE users SET status = 'offline', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(userId);
            broadcast('user-status-changed', {
              userId,
              status: 'offline'
            });
          }
        }

        // Remove from any active meeting rooms
        for (const [code, room] of meetingRooms.entries()) {
          if (room.has(userId)) {
            room.delete(userId);
            for (const [pId, pData] of room.entries()) {
              send(pData.ws, 'meeting-user-left', { userId });
            }
            if (room.size === 0) {
              meetingRooms.delete(code);
            }
          }
        }

        // Clean up active calls
        for (const [callId, call] of activeCalls.entries()) {
          if (call.callerId === userId || call.calleeId === userId) {
            const otherUserId = call.callerId === userId ? call.calleeId : call.callerId;
            sendToUser(otherUserId, 'call-ended', { callId, reason: 'Remote peer disconnected' });
            activeCalls.delete(callId);
          }
        }
      }
    });

    ws.on('error', (err) => {
      console.error('WebSocket client error:', err);
    });
  });

  // Heartbeat ping/pong interval every 30 seconds
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(pingInterval);
  });

  return { wss, connectedUsers, meetingRooms };
}

module.exports = { setupSignalingServer };
