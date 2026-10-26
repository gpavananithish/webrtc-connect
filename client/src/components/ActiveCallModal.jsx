import React, { useEffect, useRef } from 'react';
import { 
  Mic, MicOff, Video, VideoOff, ScreenShare, PhoneOff, 
  Wifi, Signal, Maximize2, ShieldCheck, Volume2 
} from 'lucide-react';

export default function ActiveCallModal({ callHook }) {
  const {
    callState,
    callType,
    remoteUser,
    callDuration,
    localStream,
    remoteStream,
    isAudioMuted,
    isVideoMuted,
    isScreenSharing,
    networkQuality,
    endCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare
  } = callHook;

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Attach local stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach remote stream & apply preferred speaker output if supported
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;

      const savedSpeaker = localStorage.getItem('connect_preferred_speaker');
      if (savedSpeaker && typeof remoteVideoRef.current.setSinkId === 'function') {
        remoteVideoRef.current.setSinkId(savedSpeaker).catch(e => {
          console.warn('Could not set preferred speaker output sinkId:', e);
        });
      }
    }
  }, [remoteStream]);

  if (callState === 'idle') return null;

  // Format call duration MM:SS
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const isAudioOnly = callType === 'audio' && !isScreenSharing;

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
      userSelect: 'none'
    }}>
      {/* Top Header Bar */}
      <div style={{
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'linear-gradient(to bottom, rgba(7, 11, 20, 0.95), rgba(7, 11, 20, 0))',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 20
      }}>
        {/* Remote User details */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img
            src={remoteUser?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(remoteUser?.displayName || 'User')}`}
            alt={remoteUser?.displayName}
            style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-medium)' }}
          />
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>
              {remoteUser?.displayName}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {callState === 'calling' ? 'Calling...' : callState === 'connecting' ? 'Connecting P2P...' : formatTime(callDuration)}
              </span>
              {callState === 'connected' && (
                <span className="badge badge-cyan" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                  Native P2P
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Network Quality Badge */}
        {callState === 'connected' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid var(--border-subtle)',
            backdropFilter: 'blur(8px)'
          }}>
            <Signal size={14} color={networkQuality === 'good' ? '#10b981' : networkQuality === 'fair' ? '#f59e0b' : '#ef4444'} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#cbd5e1', textTransform: 'capitalize' }}>
              {networkQuality} connection
            </span>
          </div>
        )}
      </div>

      {/* Main View Area */}
      <div style={{
        flex: 1,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#040711',
        overflow: 'hidden'
      }}>
        {/* Remote Video or Audio Avatar */}
        {remoteStream && !isAudioOnly ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: isScreenSharing ? 'contain' : 'cover'
            }}
          />
        ) : (
          <div style={{ textAlign: 'center', zIndex: 10 }}>
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: '24px' }}>
              <div style={{
                position: 'absolute',
                top: '-15%',
                left: '-15%',
                width: '130%',
                height: '130%',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(6, 182, 212, 0.25) 0%, transparent 70%)',
                animation: 'pulseGlow 2s infinite'
              }} />
              <img
                src={remoteUser?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(remoteUser?.displayName || 'User')}`}
                alt={remoteUser?.displayName}
                style={{
                  width: '140px',
                  height: '140px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '4px solid rgba(6, 182, 212, 0.5)',
                  boxShadow: 'var(--accent-glow)'
                }}
              />
            </div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
              {remoteUser?.displayName}
            </h2>
            <p style={{ color: 'var(--accent-cyan)', fontSize: '0.95rem', fontWeight: 500 }}>
              {callState === 'calling' ? 'Ringing...' : 'Audio Call Connected'}
            </p>

            {/* Simulated Live Audio Waves */}
            {callState === 'connected' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                height: '32px',
                marginTop: '20px'
              }}>
                {[40, 70, 90, 60, 100, 50, 80, 45, 65].map((h, i) => (
                  <div
                    key={i}
                    className="wave-bar"
                    style={{
                      height: `${h * 0.25}px`,
                      animationDelay: `${i * 0.12}s`
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Local Video Floating PiP */}
        {localStream && !isAudioOnly && (
          <div style={{
            position: 'absolute',
            bottom: '90px',
            right: '16px',
            width: 'min(180px, 40vw)',
            height: 'min(120px, 28vw)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            border: '2px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7)',
            background: '#0f172a',
            zIndex: 30
          }}>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)' // Mirror local camera preview
              }}
            />
            {isVideoMuted && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)'
              }}>
                <VideoOff size={24} />
              </div>
            )}
            <div style={{
              position: 'absolute',
              bottom: '6px',
              left: '6px',
              padding: '2px 6px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(0, 0, 0, 0.6)',
              fontSize: '0.65rem',
              fontWeight: 600,
              color: '#ffffff'
            }}>
              You {isAudioMuted ? '(Muted)' : ''}
            </div>
          </div>
        )}
      </div>

      {/* Floating Call Controls Toolbar */}
      <div style={{
        position: 'absolute',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '10px 16px',
        maxWidth: '92vw',
        width: 'max-content',
        borderRadius: 'var(--radius-xl)',
        background: 'rgba(15, 23, 42, 0.9)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--border-medium)',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
        zIndex: 40
      }}>
        {/* Toggle Audio */}
        <button
          onClick={toggleAudio}
          className={`btn btn-icon ${isAudioMuted ? 'btn-danger' : 'btn-secondary'}`}
          title={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          style={{ width: '48px', height: '48px' }}
        >
          {isAudioMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        {/* Toggle Video */}
        {callType === 'video' && (
          <button
            onClick={toggleVideo}
            className={`btn btn-icon ${isVideoMuted ? 'btn-danger' : 'btn-secondary'}`}
            title={isVideoMuted ? 'Start Camera' : 'Stop Camera'}
            style={{ width: '48px', height: '48px' }}
          >
            {isVideoMuted ? <VideoOff size={20} /> : <Video size={20} />}
          </button>
        )}

        {/* Toggle Screen Sharing */}
        <button
          onClick={toggleScreenShare}
          className={`btn btn-icon ${isScreenSharing ? 'btn-primary' : 'btn-secondary'}`}
          title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
          style={{ width: '48px', height: '48px' }}
        >
          <ScreenShare size={20} />
        </button>

        {/* End Call */}
        <button
          onClick={() => endCall(false)}
          className="btn btn-danger btn-icon"
          title="End Call"
          style={{ width: '56px', height: '56px' }}
        >
          <PhoneOff size={24} />
        </button>
      </div>
    </div>
  );
}
