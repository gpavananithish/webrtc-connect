import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import ParticipantTile from './ParticipantTile';
import { MeetingRecorder } from '../services/recorderService';
import { api } from '../services/api';
import { 
  Mic, MicOff, Video, VideoOff, ScreenShare, PhoneOff, 
  Circle, Users, MessageSquare, Copy, Check, Send, X, Shield, Link2, Pin,
  Lock, ChevronDown
} from 'lucide-react';

export default function MeetingRoom({ meshMeeting, onLeave }) {
  const { user } = useAuth();
  const {
    meetingDetails,
    participants,
    localStream,
    remoteStreams,
    isAudioMuted,
    isVideoMuted,
    isScreenSharing,
    participantStates = {},
    isRecording,
    recordingBy,
    activeSpeakerId,
    inMeetingMessages,
    leaveMeeting,
    endMeetingForEveryone,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    broadcastRecordingState,
    sendMeetingChat
  } = meshMeeting;

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [pinnedId, setPinnedId] = useState(null); // 'local' | userId | null
  const [meetingDuration, setMeetingDuration] = useState(0);
  const [activeDrawer, setActiveDrawer] = useState(null); // 'chat' | 'people' | null
  const [chatInput, setChatInput] = useState('');
  const [chatRecipient, setChatRecipient] = useState('everyone'); // 'everyone' | userId
  const [recordingLoading, setRecordingLoading] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  // Check if current user is the host who created the meeting
  const isHost = meetingDetails?.hostId === user?.id;

  // Determine who is actively sharing screen
  const remoteSharerEntry = Object.entries(participantStates).find(([uId, st]) => st && st.isScreenSharing);
  const remoteSharerId = remoteSharerEntry ? remoteSharerEntry[0] : null;
  const remoteSharerUser = remoteSharerId ? participants.find(p => p.id === remoteSharerId) : null;
  const activeScreenSharerName = isScreenSharing 
    ? 'You' 
    : (remoteSharerUser ? remoteSharerUser.displayName : null);

  // Auto-pin when someone starts screen sharing (Google Meet & Zoom behavior)
  useEffect(() => {
    if (isScreenSharing) {
      setPinnedId('local');
      return;
    }
    if (remoteSharerId) {
      setPinnedId(remoteSharerId);
    }
  }, [isScreenSharing, remoteSharerId]);

  const recorderRef = useRef(null);
  const chatScrollRef = useRef(null);

  // Initialize recorder instance once
  useEffect(() => {
    recorderRef.current = new MeetingRecorder();
    return () => {
      if (recorderRef.current && recorderRef.current.isRecording) {
        recorderRef.current.stopRecording();
      }
    };
  }, []);

  // Duration timer
  useEffect(() => {
    const timer = setInterval(() => {
      setMeetingDuration(d => d + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [inMeetingMessages]);

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleCopyCode = () => {
    if (meetingDetails?.code) {
      navigator.clipboard.writeText(meetingDetails.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleCopyLink = () => {
    if (meetingDetails?.code) {
      const joinUrl = `${window.location.origin}/?meeting=${encodeURIComponent(meetingDetails.code)}`;
      navigator.clipboard.writeText(joinUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Toggle Recording
  const handleToggleRecording = async () => {
    if (recordingLoading) return;
    setRecordingLoading(true);

    const recorder = recorderRef.current;

    if (!recorder.isRecording) {
      try {
        const videoElements = Array.from(document.querySelectorAll('video'));
        const audioStreams = [localStream, ...Object.values(remoteStreams)].filter(Boolean);

        recorder.startRecording(videoElements, audioStreams);
        broadcastRecordingState(true, user.displayName);
      } catch (err) {
        alert(`Recording error: ${err.message}`);
      }
    } else {
      try {
        const result = await recorder.stopRecording();
        broadcastRecordingState(false, null);

        if (result && result.blob) {
          await api.uploadRecording(result.blob, {
            meetingId: meetingDetails?.id,
            meetingTitle: meetingDetails?.title || 'Meeting Session',
            duration: result.duration
          });
          alert(`Meeting recording saved! (${result.duration}s) Available under Recordings tab.`);
        }
      } catch (err) {
        console.error('Failed to save recording:', err);
        alert('Failed to upload recording to server.');
      }
    }

    setRecordingLoading(false);
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (chatInput.trim()) {
      sendMeetingChat(chatInput, chatRecipient);
      setChatInput('');
    }
  };

  // Total participants = local user + remote participants
  const totalCount = 1 + participants.length;

  // Grid style based on total participant count
  const getGridStyle = () => {
    if (totalCount === 1) return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' };
    if (totalCount === 2) return { gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: '1fr' };
    if (totalCount <= 4) return { gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' };
    return { gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' };
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none',
      overflow: 'hidden'
    }}>
      {/* Top Meeting Header Bar (Zoom / Google Meet Style) */}
      <div style={{
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)',
        zIndex: 20
      }}>
        {/* Meeting Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {meetingDetails?.title || 'Team Meeting'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {formatDuration(meetingDuration)}
              </span>
              <span className="badge badge-cyan" style={{ fontSize: '0.7rem' }}>
                Mesh P2P ({totalCount}/{meetingDetails?.maxParticipants || 6})
              </span>
              {isHost && (
                <span className="badge badge-success" style={{ fontSize: '0.7rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                  Host
                </span>
              )}
            </div>
          </div>

          {/* Copy Meeting Code & Direct Link buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleCopyLink}
              className="btn btn-primary"
              style={{ padding: '6px 12px', fontSize: '0.78rem', gap: '6px', color: '#ffffff' }}
              title="Copy Direct Join Link to share like Google Meet"
            >
              {copiedLink ? <Check size={14} color="#ffffff" /> : <Link2 size={14} />}
              <span style={{ color: '#ffffff' }}>{copiedLink ? 'Link Copied!' : 'Copy Meeting Link'}</span>
            </button>

            <button
              onClick={handleCopyCode}
              className="btn btn-secondary"
              style={{ padding: '6px 10px', fontSize: '0.78rem', gap: '6px' }}
              title="Copy Meeting Code to share"
            >
              {copiedCode ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              <span>{copiedCode ? 'Copied!' : meetingDetails?.code || '---'}</span>
            </button>
          </div>
        </div>

        {/* Center: Live Screen Sharer Notice (Zoom Green Top Bar) */}
        {activeScreenSharerName && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            color: '#10b981'
          }}>
            <ScreenShare size={15} />
            <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>
              {isScreenSharing ? 'You are sharing your screen' : `${activeScreenSharerName} is sharing screen`}
            </span>
          </div>
        )}

        {/* Live Recording Indicator Banner */}
        {isRecording && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#ef4444'
          }}>
            <Circle size={10} fill="#ef4444" color="#ef4444" className="recording-pulse" />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.04em' }}>
              REC ({recordingBy ? `Started by ${recordingBy}` : 'Active'})
            </span>
          </div>
        )}

        {/* Quick Drawer Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setActiveDrawer(activeDrawer === 'people' ? null : 'people')}
            className={`btn ${activeDrawer === 'people' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '0.8rem', color: activeDrawer === 'people' ? '#ffffff' : 'var(--text-primary)' }}
          >
            <Users size={16} />
            <span style={{ color: activeDrawer === 'people' ? '#ffffff' : 'var(--text-primary)' }}>People ({totalCount})</span>
          </button>
          <button
            onClick={() => setActiveDrawer(activeDrawer === 'chat' ? null : 'chat')}
            className={`btn ${activeDrawer === 'chat' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '0.8rem', color: activeDrawer === 'chat' ? '#ffffff' : 'var(--text-primary)' }}
          >
            <MessageSquare size={16} />
            <span style={{ color: activeDrawer === 'chat' ? '#ffffff' : 'var(--text-primary)' }}>Chat</span>
          </button>
        </div>
      </div>

      {/* Center Layout: Grid / Pinned Stage + Optional Side Drawer */}
      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        {pinnedId ? (
          /* Google Meet / Zoom Pinned Stage Layout (For large screen share / speaker view) */
          <div style={{
            flex: 1,
            display: 'flex',
            gap: '16px',
            padding: '16px',
            overflow: 'hidden'
          }}>
            {/* Main Stage (Large View with dark backdrop for maximum screen clarity) */}
            <div style={{
              flex: 1,
              minHeight: 0,
              position: 'relative',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              background: '#000000',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-md)'
            }}>
              {pinnedId === 'local' ? (
                <ParticipantTile
                  user={user}
                  stream={localStream}
                  isLocal={true}
                  isAudioMuted={isAudioMuted}
                  isVideoMuted={isVideoMuted}
                  isSpeaking={activeSpeakerId === user?.id}
                  isScreenSharing={isScreenSharing}
                  isPinned={true}
                  onPin={() => setPinnedId(null)}
                />
              ) : (
                (() => {
                  const pinnedUser = participants.find(p => p.id === pinnedId);
                  const pState = participantStates[pinnedId] || {};
                  return pinnedUser ? (
                    <ParticipantTile
                      user={pinnedUser}
                      stream={remoteStreams[pinnedId]}
                      isLocal={false}
                      isAudioMuted={pState.audioMuted}
                      isVideoMuted={pState.videoMuted}
                      isSpeaking={activeSpeakerId === pinnedId}
                      isScreenSharing={pState.isScreenSharing}
                      isPinned={true}
                      onPin={() => setPinnedId(null)}
                    />
                  ) : null;
                })()
              )}
            </div>

            {/* Right Side Filmstrip (Zoom / Google Meet Style for Screen Share view) */}
            <div style={{
              width: '240px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              overflowY: 'auto',
              flexShrink: 0,
              paddingRight: '4px'
            }}>
              {/* Local User in thumbnail strip if not pinned */}
              {pinnedId !== 'local' && (
                <div style={{ width: '100%', height: '145px', flexShrink: 0 }}>
                  <ParticipantTile
                    user={user}
                    stream={localStream}
                    isLocal={true}
                    isAudioMuted={isAudioMuted}
                    isVideoMuted={isVideoMuted}
                    isSpeaking={activeSpeakerId === user?.id}
                    isScreenSharing={isScreenSharing}
                    isPinned={false}
                    onPin={() => setPinnedId('local')}
                  />
                </div>
              )}

              {/* Remote Participants in thumbnail strip */}
              {participants.filter(p => p.id !== pinnedId).map((p) => {
                const pState = participantStates[p.id] || {};
                return (
                  <div key={p.id} style={{ width: '100%', height: '145px', flexShrink: 0 }}>
                    <ParticipantTile
                      user={p}
                      stream={remoteStreams[p.id]}
                      isLocal={false}
                      isAudioMuted={pState.audioMuted}
                      isVideoMuted={pState.videoMuted}
                      isSpeaking={activeSpeakerId === p.id}
                      isScreenSharing={pState.isScreenSharing}
                      isPinned={false}
                      onPin={() => setPinnedId(p.id)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Normal Uniform Grid Layout */
          <div style={{
            flex: 1,
            padding: '16px',
            display: 'grid',
            gap: '12px',
            ...getGridStyle(),
            overflow: 'hidden'
          }}>
            {/* Local User Tile */}
            <ParticipantTile
              user={user}
              stream={localStream}
              isLocal={true}
              isAudioMuted={isAudioMuted}
              isVideoMuted={isVideoMuted}
              isSpeaking={activeSpeakerId === user?.id}
              isScreenSharing={isScreenSharing}
              isPinned={false}
              onPin={() => setPinnedId('local')}
            />

            {/* Remote Participants */}
            {participants.map((p) => {
              const pState = participantStates[p.id] || {};
              return (
                <ParticipantTile
                  key={p.id}
                  user={p}
                  stream={remoteStreams[p.id]}
                  isLocal={false}
                  isAudioMuted={pState.audioMuted}
                  isVideoMuted={pState.videoMuted}
                  isSpeaking={activeSpeakerId === p.id}
                  isScreenSharing={pState.isScreenSharing}
                  isPinned={false}
                  onPin={() => setPinnedId(p.id)}
                />
              );
            })}
          </div>
        )}

        {/* Side Drawer: Chat or People */}
        {activeDrawer && (
          <div className="glass-panel" style={{
            width: '320px',
            height: '100%',
            background: 'var(--bg-card)',
            borderLeft: '1px solid var(--border-medium)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 30,
            boxShadow: 'var(--shadow-lg)'
          }}>
            {/* Drawer Header */}
            <div style={{
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border-subtle)'
            }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {activeDrawer === 'chat' ? 'In-Meeting Chat' : `Participants (${totalCount})`}
              </div>
              <button
                onClick={() => setActiveDrawer(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* People List */}
            {activeDrawer === 'people' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                {/* Local user */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', marginBottom: '6px' }}>
                  <img src={user.avatar} alt={user.displayName} style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{user.displayName} (You)</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{meetingDetails?.hostId === user.id ? 'Host' : 'Participant'}</div>
                  </div>
                  {isAudioMuted && <MicOff size={14} color="#ef4444" />}
                </div>

                {/* Remote users */}
                {participants.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', marginBottom: '6px' }}>
                    <img src={p.avatar} alt={p.displayName} style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{p.displayName}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{meetingDetails?.hostId === p.id ? 'Host' : 'Participant'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Chat View (Zoom In-Meeting Chat Experience with Personal 1-on-1 Support) */}
            {activeDrawer === 'chat' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div ref={chatScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {inMeetingMessages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '36px', padding: '0 16px' }}>
                      <MessageSquare size={32} style={{ opacity: 0.35, marginBottom: '8px' }} />
                      <p>Send messages to everyone or choose a participant for private chat.</p>
                    </div>
                  ) : (
                    inMeetingMessages.map((m, i) => {
                      const isMe = m.sender?.id === user.id || m.sender?.username === user.username;
                      const isPrivate = !!m.isPrivate;
                      return (
                        <div key={i} style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isMe ? 'flex-end' : 'flex-start',
                          gap: '3px'
                        }}>
                          {/* Sender name, recipient badge & timestamp */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', padding: '0 4px', flexWrap: 'wrap' }}>
                            <span style={{
                              fontWeight: 700,
                              color: isMe ? 'var(--accent-cyan)' : 'var(--text-secondary)'
                            }}>
                              {isMe ? 'You' : (m.sender?.displayName || 'User')}
                            </span>

                            {isPrivate && (
                              <span style={{
                                padding: '1px 6px',
                                borderRadius: 'var(--radius-full)',
                                background: 'rgba(239, 68, 68, 0.15)',
                                color: '#ef4444',
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                border: '1px solid rgba(239, 68, 68, 0.3)'
                              }}>
                                Direct to {isMe ? (m.recipientUser?.displayName || 'User') : 'You'}
                              </span>
                            )}

                            <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                              {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          {/* Chat bubble with high-contrast text */}
                          <div style={{
                            maxWidth: '85%',
                            padding: '9px 12px',
                            borderRadius: isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                            background: isMe 
                              ? (isPrivate ? 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)' : 'var(--accent-gradient)')
                              : (isPrivate ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-secondary)'),
                            color: isMe ? '#ffffff' : 'var(--text-primary)',
                            border: isMe ? 'none' : (isPrivate ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border-subtle)'),
                            boxShadow: 'var(--shadow-sm)',
                            fontSize: '0.86rem',
                            lineHeight: 1.45,
                            wordBreak: 'break-word'
                          }}>
                            {m.text}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Zoom-Style Recipient Selector & Message Input Form */}
                <form onSubmit={handleSendChat} style={{ padding: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-secondary)' }}>
                  {/* Recipient Dropdown (Everyone vs Specific Participant) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      Send to:
                    </span>
                    <select
                      value={chatRecipient}
                      onChange={(e) => setChatRecipient(e.target.value)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-card)',
                        color: chatRecipient === 'everyone' ? 'var(--accent-cyan)' : '#ef4444',
                        border: '1px solid var(--border-medium)',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="everyone">Everyone (Meeting)</option>
                      {participants.map(p => (
                        <option key={p.id} value={p.id}>
                          Direct: {p.displayName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="input-field"
                      placeholder={chatRecipient === 'everyone' ? "Type message to everyone..." : "Type private message..."}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      style={{ padding: '9px 12px', fontSize: '0.86rem', color: 'var(--text-primary)', flex: 1 }}
                    />
                    <button type="submit" className="btn btn-primary" style={{ padding: '9px 14px', color: '#ffffff' }}>
                      <Send size={16} color="#ffffff" />
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Meeting Controls Bar (Zoom Style Toolbar) */}
      <div style={{
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-md)',
        zIndex: 20
      }}>
        {/* Left Zoom Section: Audio & Video Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Mic Toggle */}
          <button
            onClick={toggleAudio}
            className={`btn ${isAudioMuted ? 'btn-danger' : 'btn-secondary'}`}
            title={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            style={{
              padding: '8px 14px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              minWidth: '68px',
              color: isAudioMuted ? '#ffffff' : 'var(--text-primary)'
            }}
          >
            {isAudioMuted ? <MicOff size={19} color="#ffffff" /> : <Mic size={19} />}
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: isAudioMuted ? '#ffffff' : 'var(--text-primary)' }}>
              {isAudioMuted ? 'Unmute' : 'Mute'}
            </span>
          </button>

          {/* Cam Toggle */}
          <button
            onClick={toggleVideo}
            className={`btn ${isVideoMuted ? 'btn-danger' : 'btn-secondary'}`}
            title={isVideoMuted ? 'Start Video' : 'Stop Video'}
            style={{
              padding: '8px 14px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              minWidth: '68px',
              color: isVideoMuted ? '#ffffff' : 'var(--text-primary)'
            }}
          >
            {isVideoMuted ? <VideoOff size={19} color="#ffffff" /> : <Video size={19} />}
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: isVideoMuted ? '#ffffff' : 'var(--text-primary)' }}>
              {isVideoMuted ? 'Start Video' : 'Stop Video'}
            </span>
          </button>
        </div>

        {/* Center Zoom Section: Collaboration & Features */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Security / Info */}
          <button
            onClick={handleCopyLink}
            className="btn btn-secondary"
            title="Meeting Security & Share Link"
            style={{
              padding: '8px 14px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              minWidth: '68px',
              color: 'var(--text-primary)'
            }}
          >
            <Shield size={19} />
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-primary)' }}>Security</span>
          </button>

          {/* Participants */}
          <button
            onClick={() => setActiveDrawer(activeDrawer === 'people' ? null : 'people')}
            className={`btn ${activeDrawer === 'people' ? 'btn-primary' : 'btn-secondary'}`}
            title="View Participants"
            style={{
              padding: '8px 14px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              minWidth: '68px',
              position: 'relative',
              color: activeDrawer === 'people' ? '#ffffff' : 'var(--text-primary)'
            }}
          >
            <Users size={19} color={activeDrawer === 'people' ? '#ffffff' : 'currentColor'} />
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: activeDrawer === 'people' ? '#ffffff' : 'var(--text-primary)' }}>
              Participants
            </span>
            <span style={{
              position: 'absolute',
              top: '4px',
              right: '8px',
              fontSize: '0.65rem',
              fontWeight: 700,
              padding: '1px 5px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--accent-cyan)',
              color: '#ffffff'
            }}>
              {totalCount}
            </span>
          </button>

          {/* In-Meeting Chat (Fixed text contrast and active style) */}
          <button
            onClick={() => setActiveDrawer(activeDrawer === 'chat' ? null : 'chat')}
            className={`btn ${activeDrawer === 'chat' ? 'btn-primary' : 'btn-secondary'}`}
            title="Open Chat"
            style={{
              padding: '8px 14px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              minWidth: '68px',
              color: activeDrawer === 'chat' ? '#ffffff' : 'var(--text-primary)'
            }}
          >
            <MessageSquare size={19} color={activeDrawer === 'chat' ? '#ffffff' : 'currentColor'} />
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: activeDrawer === 'chat' ? '#ffffff' : 'var(--text-primary)' }}>
              Chat
            </span>
          </button>

          {/* Screen Share (Prominent Zoom Green / Cyan Accent) */}
          <button
            onClick={toggleScreenShare}
            className={`btn ${isScreenSharing ? 'btn-primary' : 'btn-secondary'}`}
            title={isScreenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
            style={{
              padding: '8px 14px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              minWidth: '82px',
              color: isScreenSharing ? '#ffffff' : 'var(--status-online)',
              borderColor: isScreenSharing ? 'transparent' : 'rgba(16, 185, 129, 0.4)'
            }}
          >
            <ScreenShare size={19} color={isScreenSharing ? '#ffffff' : 'var(--status-online)'} />
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: isScreenSharing ? '#ffffff' : 'var(--status-online)' }}>
              {isScreenSharing ? 'Sharing' : 'Share Screen'}
            </span>
          </button>

          {/* Meeting Recorder */}
          <button
            onClick={handleToggleRecording}
            disabled={recordingLoading}
            className={`btn ${recorderRef.current?.isRecording ? 'btn-danger recording-pulse' : 'btn-secondary'}`}
            title={recorderRef.current?.isRecording ? 'Stop Recording' : 'Record Full Meeting'}
            style={{
              padding: '8px 14px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              minWidth: '68px',
              color: recorderRef.current?.isRecording ? '#ffffff' : 'var(--text-primary)'
            }}
          >
            <Circle size={19} fill={recorderRef.current?.isRecording ? '#ffffff' : '#ef4444'} color="#ef4444" />
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: recorderRef.current?.isRecording ? '#ffffff' : 'var(--text-primary)' }}>
              {recorderRef.current?.isRecording ? 'Stop Rec' : 'Record'}
            </span>
          </button>
        </div>

        {/* Right Zoom Section: End / Leave Meeting Button */}
        <div>
          <button
            onClick={() => setShowLeaveModal(true)}
            className="btn btn-danger"
            style={{
              padding: '9px 18px',
              fontWeight: 700,
              fontSize: '0.86rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderRadius: 'var(--radius-md)',
              color: '#ffffff'
            }}
            title={isHost ? 'End or Leave Meeting' : 'Leave Meeting'}
          >
            <PhoneOff size={16} color="#ffffff" />
            <span style={{ color: '#ffffff' }}>{isHost ? 'End' : 'Leave'}</span>
          </button>
        </div>
      </div>

      {/* Zoom-Style Leave / End Meeting Modal */}
      {showLeaveModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '420px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-xl)',
            padding: '28px',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            textAlign: 'center'
          }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              color: '#ef4444'
            }}>
              <PhoneOff size={24} />
            </div>

            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
                {isHost ? 'End Meeting for All?' : 'Leave Meeting?'}
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                {isHost
                  ? 'As the host, you can end this meeting for all participants, or leave the meeting while allowing others to continue.'
                  : 'Are you sure you want to disconnect from this meeting? You can rejoin anytime using the link.'}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
              {isHost && (
                <button
                  onClick={() => {
                    endMeetingForEveryone();
                    setShowLeaveModal(false);
                    if (onLeave) onLeave();
                  }}
                  className="btn btn-danger"
                  style={{ width: '100%', padding: '12px', fontSize: '0.92rem', fontWeight: 700, color: '#ffffff' }}
                >
                  End Meeting for All
                </button>
              )}

              <button
                onClick={() => {
                  leaveMeeting();
                  setShowLeaveModal(false);
                  if (onLeave) onLeave();
                }}
                className={`btn ${isHost ? 'btn-secondary' : 'btn-danger'}`}
                style={{ width: '100%', padding: '12px', fontSize: '0.92rem', fontWeight: 700, color: isHost ? 'var(--text-primary)' : '#ffffff' }}
              >
                Leave Meeting
              </button>

              <button
                onClick={() => setShowLeaveModal(false)}
                className="btn btn-secondary"
                style={{ width: '100%', padding: '10px', fontSize: '0.88rem', color: 'var(--text-muted)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
