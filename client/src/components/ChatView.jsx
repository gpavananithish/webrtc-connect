import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSignaling } from '../context/SignalingContext';
import { api } from '../services/api';
import MessageBubble from './MessageBubble';
import VoiceRecorder from './VoiceRecorder';
import { 
  Phone, Video, Send, Paperclip, Mic, Search, X, Smile, MessageSquare, CheckCheck, ArrowLeft, Plus, UserPlus 
} from 'lucide-react';

export default function ChatView({ onStartCall, selectedUserId = null }) {
  const { user } = useAuth();
  const { on, sendSignaling, onlineUserIds } = useSignaling();

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [isMobileViewingChat, setIsMobileViewingChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [remoteTyping, setRemoteTyping] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchText, setUserSearchText] = useState('');

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const activeConversationRef = useRef(null);

  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  // Load conversations on mount
  const fetchConversations = async () => {
    try {
      const res = await api.getConversations();
      setConversations(res.conversations || []);
      if (!activeConversation && res.conversations?.length > 0) {
        // If a specific target user was passed, select or open that conversation
        if (selectedUserId) {
          handleSelectUser(selectedUserId);
        } else {
          setActiveConversation(res.conversations[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  // When selectedUserId prop changes
  useEffect(() => {
    if (selectedUserId) {
      handleSelectUser(selectedUserId);
    }
  }, [selectedUserId]);

  const handleSelectUser = async (targetId) => {
    try {
      const res = await api.getOrCreateDirectConversation(targetId);
      const convs = await api.getConversations();
      const updatedList = convs.conversations || [];
      setConversations(updatedList);
      const matched = updatedList.find(c => c.id === res.conversationId);
      if (matched) {
        setActiveConversation(matched);
      } else if (res.conversation) {
        setActiveConversation(res.conversation);
      }
      setIsMobileViewingChat(true);
      setShowNewChatModal(false);
    } catch (err) {
      console.error('Error starting direct chat:', err);
    }
  };

  const handleOpenNewChatModal = async () => {
    setShowNewChatModal(true);
    setLoadingUsers(true);
    try {
      const res = await api.getUsers();
      setAllUsers(res.users || []);
    } catch (err) {
      console.error('Failed to fetch user directory for new chat:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Mark conversation as read ONLY if document is visible and focused
  const markAsReadIfVisible = (convId) => {
    const currentConv = activeConversationRef.current;
    const targetConvId = convId || currentConv?.id;
    if (!targetConvId) return;

    if (document.visibilityState === 'visible' && document.hasFocus()) {
      api.markConversationAsRead(targetConvId).catch(() => {});

      // Notify other participants via WebSocket that messages have been read
      const participants = currentConv?.id === targetConvId ? currentConv.participants : null;
      if (participants) {
        const otherParticipantIds = participants
          .filter(p => p.id !== user.id)
          .map(p => p.id);

        sendSignaling('chat-messages-read', {
          conversationId: targetConvId,
          targetUserIds: otherParticipantIds
        });
      }
    }
  };

  // Load messages whenever active conversation changes
  useEffect(() => {
    if (!activeConversation) return;

    api.getMessages(activeConversation.id)
      .then(res => {
        setMessages(res.messages || []);
        markAsReadIfVisible(activeConversation.id);
      })
      .catch(err => console.error('Failed to fetch messages:', err));
  }, [activeConversation]);

  // Handle document focus and visibility changes (when user returns to the tab)
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (activeConversation && document.visibilityState === 'visible' && document.hasFocus()) {
        markAsReadIfVisible(activeConversation.id);
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [activeConversation]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, remoteTyping]);

  // Setup WebSocket Listeners for Chat
  useEffect(() => {
    const unsubMessage = on('new-chat-message', (payload) => {
      if (activeConversation && payload.conversationId === activeConversation.id) {
        setMessages(prev => {
          // Prevent duplicate messages if already present
          if (prev.some(m => m.id === payload.message.id)) {
            return prev;
          }
          return [...prev, payload.message];
        });
        // Only mark read if user is currently inside the tab looking at it!
        markAsReadIfVisible(activeConversation.id);
      }
      fetchConversations();
    });

    // Real-time delivery receipt update (user online -> double gray tick)
    const unsubStatusUpdate = on('message-status-updated', (payload) => {
      if (activeConversation && payload.conversationId === activeConversation.id) {
        setMessages(prev => prev.map(m => 
          m.id === payload.messageId ? { ...m, status: payload.status } : m
        ));
      }
    });

    // Real-time read receipt update (user viewed -> double green tick)
    const unsubReadReceipt = on('messages-read-receipt', (payload) => {
      if (activeConversation && payload.conversationId === activeConversation.id) {
        setMessages(prev => prev.map(m => 
          m.senderId === user.id ? { ...m, status: 'read' } : m
        ));
      }
      fetchConversations();
    });

    const unsubEdit = on('chat-message-edited', (payload) => {
      if (activeConversation && payload.conversationId === activeConversation.id) {
        setMessages(prev => prev.map(m => 
          m.id === payload.messageId ? { ...m, content: payload.content, isEdited: true } : m
        ));
      }
      fetchConversations();
    });

    const unsubDelete = on('chat-message-deleted', (payload) => {
      if (activeConversation && payload.conversationId === activeConversation.id) {
        setMessages(prev => prev.map(m => 
          m.id === payload.messageId ? { ...m, content: 'This message was deleted', isDeleted: true } : m
        ));
      }
      fetchConversations();
    });

    const unsubTyping = on('user-typing', (payload) => {
      if (activeConversation && payload.conversationId === activeConversation.id) {
        if (payload.isTyping) {
          setRemoteTyping(payload.displayName);
        } else {
          setRemoteTyping(null);
        }
      }
    });

    return () => {
      unsubMessage();
      unsubStatusUpdate();
      unsubReadReceipt();
      unsubEdit();
      unsubDelete();
      unsubTyping();
    };
  }, [on, activeConversation]);

  // Handle typing indicator
  const handleInputChange = (e) => {
    setInputText(e.target.value);

    if (activeConversation) {
      const otherParticipantIds = activeConversation.participants
        ?.filter(p => p.id !== user.id)
        .map(p => p.id) || [];

      sendSignaling('typing-indicator', {
        conversationId: activeConversation.id,
        targetUserIds: otherParticipantIds,
        isTyping: true
      });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        sendSignaling('typing-indicator', {
          conversationId: activeConversation.id,
          targetUserIds: otherParticipantIds,
          isTyping: false
        });
      }, 1500);
    }
  };

  // Send text message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConversation) return;

    const content = inputText.trim();
    setInputText('');

    try {
      const res = await api.sendMessage(activeConversation.id, {
        content,
        replyToId: replyingTo ? replyingTo.id : null
      });

      // If any recipient is online, immediately show double gray tick (delivered)
      const otherParticipantIds = activeConversation.participants
        ?.filter(p => p.id !== user.id)
        .map(p => p.id) || [];
      const isAnyRecipientOnline = otherParticipantIds.some(id => onlineUserIds && onlineUserIds.has(id));

      const initialMessage = {
        ...res.message,
        status: isAnyRecipientOnline ? 'delivered' : (res.message.status || 'sent')
      };

      setMessages(prev => {
        if (prev.some(m => m.id === initialMessage.id)) return prev;
        return [...prev, initialMessage];
      });
      setReplyingTo(null);

      // Notify other participants via WebSocket
      sendSignaling('chat-message-sent', {
        conversationId: activeConversation.id,
        targetUserIds: otherParticipantIds,
        message: initialMessage
      });

      fetchConversations();
    } catch (err) {
      console.error('Send message error:', err);
    }
  };

  // File Upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeConversation) return;

    setUploadingFile(true);
    try {
      const uploadRes = await api.uploadFile(file, activeConversation.id);

      const res = await api.sendMessage(activeConversation.id, {
        content: '',
        messageType: 'file',
        fileId: uploadRes.file.id,
        replyToId: replyingTo ? replyingTo.id : null
      });

      const otherParticipantIds = activeConversation.participants
        ?.filter(p => p.id !== user.id)
        .map(p => p.id) || [];
      const isAnyRecipientOnline = otherParticipantIds.some(id => onlineUserIds && onlineUserIds.has(id));

      const initialMessage = {
        ...res.message,
        status: isAnyRecipientOnline ? 'delivered' : (res.message.status || 'sent')
      };

      setMessages(prev => {
        if (prev.some(m => m.id === initialMessage.id)) return prev;
        return [...prev, initialMessage];
      });
      setReplyingTo(null);

      sendSignaling('chat-message-sent', {
        conversationId: activeConversation.id,
        targetUserIds: otherParticipantIds,
        message: initialMessage
      });

      fetchConversations();
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Voice message
  const handleSendVoice = async (audioBlob, duration) => {
    if (!activeConversation) return;
    setIsRecordingVoice(false);

    try {
      const uploadRes = await api.uploadVoiceMessage(audioBlob, duration, activeConversation.id);

      const res = await api.sendMessage(activeConversation.id, {
        content: '',
        messageType: 'voice',
        fileId: uploadRes.file.id
      });

      const otherParticipantIds = activeConversation.participants
        ?.filter(p => p.id !== user.id)
        .map(p => p.id) || [];
      const isAnyRecipientOnline = otherParticipantIds.some(id => onlineUserIds && onlineUserIds.has(id));

      const initialMessage = {
        ...res.message,
        status: isAnyRecipientOnline ? 'delivered' : (res.message.status || 'sent')
      };

      setMessages(prev => {
        if (prev.some(m => m.id === initialMessage.id)) return prev;
        return [...prev, initialMessage];
      });

      sendSignaling('chat-message-sent', {
        conversationId: activeConversation.id,
        targetUserIds: otherParticipantIds,
        message: initialMessage
      });

      fetchConversations();
    } catch (err) {
      alert(`Voice message error: ${err.message}`);
    }
  };

  const handleEditMessage = async (messageId, newContent) => {
    try {
      await api.editMessage(messageId, newContent);
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: newContent, isEdited: true } : m));

      // Broadcast edit to other participants
      const otherParticipantIds = activeConversation.participants
        ?.filter(p => p.id !== user.id)
        .map(p => p.id) || [];

      sendSignaling('chat-message-edited', {
        conversationId: activeConversation.id,
        targetUserIds: otherParticipantIds,
        messageId,
        content: newContent
      });

      fetchConversations();
    } catch (err) {
      alert('Failed to edit message');
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      await api.deleteMessage(messageId);
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: 'This message was deleted', isDeleted: true } : m));

      // Broadcast delete to other participants
      const otherParticipantIds = activeConversation.participants
        ?.filter(p => p.id !== user.id)
        .map(p => p.id) || [];

      sendSignaling('chat-message-deleted', {
        conversationId: activeConversation.id,
        targetUserIds: otherParticipantIds,
        messageId
      });

      fetchConversations();
    } catch (err) {
      alert('Failed to delete message');
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const targetParticipant = activeConversation?.otherParticipant;
  const isTargetOnline = targetParticipant ? onlineUserIds.has(targetParticipant.id) : false;

  return (
    <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* Left Column: Conversations List */}
      <div 
        className={isMobileViewingChat ? 'mobile-hide' : 'mobile-full'}
        style={{
          width: '320px',
          height: '100%',
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0
        }}
      >
        {/* Header with Title and "New Chat" Button */}
        <div style={{
          padding: '16px 16px 12px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Chats
            </h2>
            <button
              onClick={handleOpenNewChatModal}
              className="btn btn-primary"
              style={{
                padding: '6px 12px',
                fontSize: '0.78rem',
                gap: '6px',
                borderRadius: 'var(--radius-full)'
              }}
              title="Start a new chat with any team member"
            >
              <UserPlus size={15} />
              <span>New Chat</span>
            </button>
          </div>

          <div style={{ position: 'relative' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
            <input
              type="text"
              className="input-field"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '36px', paddingRight: '12px', paddingBottom: '8px', paddingTop: '8px', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        {/* Conversations Feed */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {filteredConversations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No conversations found. Start one from the Contacts tab!
            </div>
          ) : (
            filteredConversations.map(conv => {
              const other = conv.otherParticipant;
              const isSelected = activeConversation?.id === conv.id;
              const isOnline = other ? onlineUserIds.has(other.id) : false;

              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    setActiveConversation(conv);
                    setIsMobileViewingChat(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
                    border: isSelected ? '1px solid rgba(6, 182, 212, 0.25)' : '1px solid transparent',
                    marginBottom: '4px',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ position: 'relative' }}>
                    <img
                      src={other?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(conv.name)}`}
                      alt={conv.name}
                      style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <span
                      className={`status-dot ${isOnline ? 'online' : 'offline'}`}
                      style={{ position: 'absolute', bottom: 0, right: 0, border: '2px solid var(--bg-primary)' }}
                    />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {conv.name}
                      </span>
                      {conv.lastMessage && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          {new Date(conv.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {conv.lastMessage ? conv.lastMessage.content : 'No messages yet'}
                      </span>
                      {conv.unreadCount > 0 && (
                        <span style={{
                          background: 'var(--accent-cyan)',
                          color: '#ffffff',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 'var(--radius-full)'
                        }}>
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Active Conversation */}
      {activeConversation ? (
        <div 
          className={!isMobileViewingChat ? 'mobile-hide' : 'mobile-full'}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)' }}
        >
          {/* Conversation Header */}
          <div style={{
            padding: '10px 14px',
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            zIndex: 10,
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              {/* Mobile Back Button (Only visible on mobile screens) */}
              <button
                onClick={() => setIsMobileViewingChat(false)}
                className="btn btn-secondary btn-icon desktop-hide"
                style={{ width: '34px', height: '34px', flexShrink: 0 }}
                title="Back to conversation list"
              >
                <ArrowLeft size={18} />
              </button>

              <div style={{ position: 'relative', flexShrink: 0 }}>
                <img
                  src={targetParticipant?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(activeConversation.name)}`}
                  alt={activeConversation.name}
                  style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }}
                />
                <span
                  className={`status-dot ${isTargetOnline ? 'online' : 'offline'}`}
                  style={{ position: 'absolute', bottom: 0, right: 0, border: '2px solid var(--bg-secondary)' }}
                />
              </div>

              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {activeConversation.name}
                </div>
                <div style={{ fontSize: '0.7rem', color: isTargetOnline ? 'var(--status-online)' : 'var(--text-muted)' }}>
                  {isTargetOnline ? 'Active Now' : 'Offline'}
                </div>
              </div>
            </div>

            {/* Quick Call Action Buttons */}
            {targetParticipant && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <button
                  onClick={() => onStartCall(targetParticipant, 'audio')}
                  className="btn btn-secondary"
                  style={{ padding: '7px 10px', fontSize: '0.8rem' }}
                  title="Start Real-Time Audio Call"
                >
                  <Phone size={15} color="var(--accent-cyan)" />
                  <span className="mobile-hide">Audio Call</span>
                </button>

                <button
                  onClick={() => onStartCall(targetParticipant, 'video')}
                  className="btn btn-primary"
                  style={{ padding: '7px 12px', fontSize: '0.8rem' }}
                  title="Start Real-Time Video Call"
                >
                  <Video size={15} color="#ffffff" />
                  <span className="mobile-hide">Video Call</span>
                </button>
              </div>
            )}
          </div>

          {/* Messages Area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column' }}>
            {messages.length === 0 ? (
              <div style={{
                margin: 'auto',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.9rem'
              }}>
                <div style={{ marginBottom: '10px' }}>
                  <MessageSquare size={36} color="rgba(6, 182, 212, 0.4)" />
                </div>
                <div>No messages here yet.</div>
                <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>Send a greeting or start an instant audio/video call!</div>
              </div>
            ) : (
              messages.map(msg => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isMine={msg.senderId === user.id}
                  onReply={(m) => setReplyingTo(m)}
                  onEdit={handleEditMessage}
                  onDelete={handleDeleteMessage}
                />
              ))
            )}

            {/* Remote typing indicator */}
            {remoteTyping && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                background: 'rgba(255, 255, 255, 0.04)',
                borderRadius: 'var(--radius-full)',
                width: 'fit-content',
                fontSize: '0.75rem',
                color: 'var(--accent-cyan)',
                marginTop: '6px'
              }}>
                <span className="wave-bar" style={{ height: '8px' }} />
                <span>{remoteTyping} is typing...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quoted reply banner */}
          {replyingTo && (
            <div style={{
              padding: '8px 16px',
              background: 'rgba(15, 23, 42, 0.95)',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.8rem'
            }}>
              <div>
                <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>Replying to {replyingTo.senderDisplayName}: </span>
                <span style={{ color: 'var(--text-muted)' }}>{replyingTo.content}</span>
              </div>
              <button
                onClick={() => setReplyingTo(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Bottom Chat Input Bar */}
          <div style={{
            padding: '16px 20px',
            background: 'var(--bg-secondary)',
            borderTop: '1px solid var(--border-subtle)'
          }}>
            {isRecordingVoice ? (
              <VoiceRecorder
                onSendVoice={handleSendVoice}
                onCancel={() => setIsRecordingVoice(false)}
              />
            ) : (
              <form onSubmit={handleSendMessage} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* File Attachment */}
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  disabled={uploadingFile}
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-secondary btn-icon"
                  style={{ width: '42px', height: '42px', flexShrink: 0 }}
                  title="Upload Document or Image"
                >
                  <Paperclip size={18} />
                </button>

                {/* Voice Recorder Toggle */}
                <button
                  type="button"
                  onClick={() => setIsRecordingVoice(true)}
                  className="btn btn-secondary btn-icon"
                  style={{ width: '42px', height: '42px', flexShrink: 0 }}
                  title="Record Voice Message"
                >
                  <Mic size={18} />
                </button>

                {/* Text Input */}
                <input
                  type="text"
                  className="input-field"
                  placeholder="Type a message... (Press Enter to send)"
                  value={inputText}
                  onChange={handleInputChange}
                  style={{ padding: '10px 16px', fontSize: '0.9rem' }}
                />

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="btn btn-primary"
                  style={{ padding: '10px 18px', flexShrink: 0 }}
                >
                  <Send size={16} />
                  <span>Send</span>
                </button>
              </form>
            )}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '14px', padding: '24px' }}>
          <MessageSquare size={48} color="var(--border-medium)" />
          <div style={{ fontSize: '1rem', fontWeight: 600 }}>Select a conversation or start a new chat</div>
          <button
            onClick={handleOpenNewChatModal}
            className="btn btn-primary"
            style={{ borderRadius: 'var(--radius-full)', padding: '8px 18px' }}
          >
            <UserPlus size={16} />
            <span>Start New Chat</span>
          </button>
        </div>
      )}

      {/* New Chat User Selection Modal */}
      {showNewChatModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div className="glass-card" style={{
            width: '100%',
            maxWidth: '440px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-medium)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-lg)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <UserPlus size={20} color="var(--accent-cyan)" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  New Chat
                </h3>
              </div>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="btn btn-secondary btn-icon"
                style={{ width: '32px', height: '32px' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Search */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                <input
                  type="text"
                  className="input-field"
                  placeholder="Search team member name or email..."
                  value={userSearchText}
                  onChange={(e) => setUserSearchText(e.target.value)}
                  style={{ paddingLeft: '36px', fontSize: '0.88rem', paddingBottom: '8px', paddingTop: '8px' }}
                />
              </div>
            </div>

            {/* Users List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
              {loadingUsers ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  Loading team directory...
                </div>
              ) : (
                (() => {
                  const filtered = allUsers.filter(u => 
                    u.displayName?.toLowerCase().includes(userSearchText.toLowerCase()) ||
                    u.email?.toLowerCase().includes(userSearchText.toLowerCase())
                  );

                  if (filtered.length === 0) {
                    return (
                      <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                        No team members found.
                      </div>
                    );
                  }

                  return filtered.map(u => {
                    const isOnline = onlineUserIds.has(u.id);
                    return (
                      <div
                        key={u.id}
                        onClick={() => handleSelectUser(u.id)}
                        className="item-card-hover"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                          marginBottom: '4px',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <img
                            src={u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.displayName || 'User')}`}
                            alt={u.displayName}
                            style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                          />
                          <span
                            className={`status-dot ${isOnline ? 'online' : 'offline'}`}
                            style={{ position: 'absolute', bottom: 0, right: 0, border: '2px solid var(--bg-secondary)' }}
                          />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {u.displayName}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {u.title || 'Developer'} • {isOnline ? 'Online' : 'Offline'}
                          </div>
                        </div>

                        <button
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: 'var(--radius-full)' }}
                        >
                          Chat
                        </button>
                      </div>
                    );
                  });
                })()
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
