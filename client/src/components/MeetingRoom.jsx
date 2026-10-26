import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import ParticipantTile from './ParticipantTile';
import { MeetingRecorder } from '../services/recorderService';
import { api } from '../services/api';
import { 
  Mic, MicOff, Video, VideoOff, ScreenShare, PhoneOff, 
  Circle, Users, MessageSquare, Copy, Check, Send, X, Shield 
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
    isRecording,
    recordingBy,
    activeSpeakerId,
    inMeetingMessages,
    leaveMeeting,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    broadcastRecordingState,
    sendMeetingChat
  } = meshMeeting;

  const [copied, setCopied] = useState(false);
  const [meetingDuration, setMeetingDuration] = useState(0);
  const [activeDrawer, setActiveDrawer] = useState(null); // 'chat' | 'people' | null
  const [chatInput, setChatInput] = useState('');
  const [recordingLoading, setRecordingLoading] = useState(false);

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
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Toggle Recording
  const handleToggleRecording = async () => {
    if (recordingLoading) return;
    setRecordingLoading(true);

    const recorder = recorderRef.current;

    if (!recorder.isRecording) {
      try {
        // Collect all active video elements and audio streams
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
          // Upload recording to backend
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
      sendMeetingChat(chatInput);
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
      background: '#070b14',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none',
      overflow: 'hidden'
    }}>
      {/* Top Meeting Header Bar */}
      <div style={{
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(15, 23, 42, 0.9)',
        borderBottom: '1px solid var(--border-subtle)',
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
            </div>
          </div>

          {/* Copy Meeting Code button */}
          <button
            onClick={handleCopyCode}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.78rem' }}
            title="Copy Meeting Code to share"
          >
            {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
            <span>{copied ? 'Copied!' : `Code: ${meetingDetails?.code || '---'}`}</span>
          </button>
        </div>

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
            color: '#f87171'
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
            className={`btn btn-secondary ${activeDrawer === 'people' ? 'btn-primary' : ''}`}
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
          >
            <Users size={16} />
            <span>People ({totalCount})</span>
          </button>
          <button
            onClick={() => setActiveDrawer(activeDrawer === 'chat' ? null : 'chat')}
            className={`btn btn-secondary ${activeDrawer === 'chat' ? 'btn-primary' : ''}`}
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
          >
            <MessageSquare size={16} />
            <span>Chat</span>
          </button>
        </div>
      </div>

      {/* Center Layout: Grid + Optional Side Drawer */}
      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        {/* Participant Video Grid */}
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
          />

          {/* Remote Participants */}
          {participants.map((p) => (
            <ParticipantTile
              key={p.id}
              user={p}
              stream={remoteStreams[p.id]}
              isLocal={false}
              isAudioMuted={false}
              isVideoMuted={false}
              isSpeaking={activeSpeakerId === p.id}
              isScreenSharing={false}
            />
          ))}
        </div>

        {/* Side Drawer: Chat or People */}
        {activeDrawer && (
          <div className="glass-panel" style={{
            width: '320px',
            height: '100%',
            background: 'rgba(15, 23, 42, 0.95)',
            borderLeft: '1px solid var(--border-medium)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 30
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'rgba(255, 255, 255, 0.04)', marginBottom: '6px' }}>
                  <img src={user.avatar} alt={user.displayName} style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user.displayName} (You)</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{meetingDetails?.hostId === user.id ? 'Host' : 'Participant'}</div>
                  </div>
                  {isAudioMuted && <MicOff size={14} color="#ef4444" />}
                </div>

                {/* Remote users */}
                {participants.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: 'var(--radius-sm)', marginBottom: '6px' }}>
                    <img src={p.avatar} alt={p.displayName} style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{p.displayName}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{meetingDetails?.hostId === p.id ? 'Host' : 'Participant'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Chat View */}
            {activeDrawer === 'chat' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div ref={chatScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {inMeetingMessages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '30px' }}>
                      Messages sent here are visible to all meeting participants.
                    </div>
                  ) : (
                    inMeetingMessages.map((m, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
                          <span style={{ fontWeight: 700, color: m.sender?.id === user.id ? 'var(--accent-cyan)' : '#f8fafc' }}>
                            {m.sender?.displayName || 'User'}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                            {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div style={{
                          background: m.sender?.id === user.id ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.85rem',
                          color: 'var(--text-primary)'
                        }}>
                          {m.text}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleSendChat} style={{ padding: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Type in-meeting message..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                  />
                  <button type="submit" className="btn btn-primary" style={{ padding: '8px 12px' }}>
                    <Send size={16} />
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Meeting Controls Bar */}
      <div style={{
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        background: 'rgba(15, 23, 42, 0.95)',
        borderTop: '1px solid var(--border-subtle)',
        zIndex: 20
      }}>
        {/* Mic Toggle */}
        <button
          onClick={toggleAudio}
          className={`btn btn-icon ${isAudioMuted ? 'btn-danger' : 'btn-secondary'}`}
          title={isAudioMuted ? 'Unmute Mic' : 'Mute Mic'}
          style={{ width: '48px', height: '48px' }}
        >
          {isAudioMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        {/* Cam Toggle */}
        <button
          onClick={toggleVideo}
          className={`btn btn-icon ${isVideoMuted ? 'btn-danger' : 'btn-secondary'}`}
          title={isVideoMuted ? 'Start Camera' : 'Stop Camera'}
          style={{ width: '48px', height: '48px' }}
        >
          {isVideoMuted ? <VideoOff size={20} /> : <Video size={20} />}
        </button>

        {/* Screen Share */}
        <button
          onClick={toggleScreenShare}
          className={`btn btn-icon ${isScreenSharing ? 'btn-primary' : 'btn-secondary'}`}
          title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
          style={{ width: '48px', height: '48px' }}
        >
          <ScreenShare size={20} />
        </button>

        {/* Meeting Recorder */}
        <button
          onClick={handleToggleRecording}
          disabled={recordingLoading}
          className={`btn ${recorderRef.current?.isRecording ? 'btn-danger recording-pulse' : 'btn-secondary'}`}
          title={recorderRef.current?.isRecording ? 'Stop Recording & Save to Server' : 'Record Full Meeting'}
          style={{ padding: '10px 16px' }}
        >
          <Circle size={16} fill={recorderRef.current?.isRecording ? '#ffffff' : '#ef4444'} color="#ef4444" />
          <span>{recorderRef.current?.isRecording ? 'Stop Recording' : 'Record Meeting'}</span>
        </button>

        {/* Leave Meeting */}
        <button
          onClick={() => {
            leaveMeeting();
            if (onLeave) onLeave();
          }}
          className="btn btn-danger"
          style={{ padding: '10px 20px', gap: '8px' }}
          title="Leave Meeting Room"
        >
          <PhoneOff size={18} />
          <span>Leave Room</span>
        </button>
      </div>
    </div>
  );
}
