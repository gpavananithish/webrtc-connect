import React, { useRef, useEffect } from 'react';
import { MicOff, Pin, User } from 'lucide-react';

export default function ParticipantTile({ 
  user, 
  stream, 
  isLocal = false, 
  isAudioMuted = false, 
  isVideoMuted = false,
  isSpeaking = false,
  isScreenSharing = false,
  isPinned = false,
  onPin = null
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;

      // Apply output device for remote participants if supported
      if (!isLocal) {
        const savedSpeaker = localStorage.getItem('connect_preferred_speaker');
        if (savedSpeaker && typeof videoRef.current.setSinkId === 'function') {
          videoRef.current.setSinkId(savedSpeaker).catch(e => {
            console.warn('Could not set preferred speaker output sinkId on tile:', e);
          });
        }
      }
    }
  }, [stream, isLocal]);

  const hasVideo = stream && stream.getVideoTracks().length > 0 && !isVideoMuted;

  return (
    <div 
      className={`glass-card ${isSpeaking ? 'speaking-active' : ''}`}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '200px',
        background: '#0a0f1d',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius-lg)',
        border: isSpeaking ? '2px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
        transition: 'all 0.2s ease'
      }}
    >
      {/* Video Element */}
      {stream && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal} // Always mute local video element to avoid echo
          style={{
            width: '100%',
            height: '100%',
            objectFit: isScreenSharing ? 'contain' : 'cover',
            display: hasVideo ? 'block' : 'none',
            transform: isLocal && !isScreenSharing ? 'scaleX(-1)' : 'none'
          }}
        />
      )}

      {/* Fallback Avatar when camera is disabled or stream has no video */}
      {!hasVideo && (
        <div style={{ textAlign: 'center', zIndex: 5 }}>
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: '12px' }}>
            <img
              src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user?.displayName || 'User')}`}
              alt={user?.displayName}
              style={{
                width: '76px',
                height: '76px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '3px solid var(--border-medium)',
                boxShadow: isSpeaking ? '0 0 20px rgba(6, 182, 212, 0.4)' : 'none'
              }}
            />
          </div>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#ffffff' }}>
            {user?.displayName} {isLocal && '(You)'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Camera off
          </div>
        </div>
      )}

      {/* Overlay: Name & Mute status badge */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: 'var(--radius-full)',
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        zIndex: 10
      }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f8fafc' }}>
          {user?.displayName} {isLocal && '(You)'}
        </span>
        {isAudioMuted && (
          <span title="Muted" style={{ display: 'flex', alignItems: 'center' }}>
            <MicOff size={12} color="#ef4444" />
          </span>
        )}
      </div>

      {/* Top Controls: Screen Sharing & Pin Action */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        right: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 15,
        pointerEvents: 'none'
      }}>
        {/* Screen Sharing Badge */}
        {isScreenSharing ? (
          <div style={{
            padding: '4px 8px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(6, 182, 212, 0.25)',
            border: '1px solid rgba(6, 182, 212, 0.5)',
            color: 'var(--accent-cyan)',
            fontSize: '0.7rem',
            fontWeight: 700,
            backdropFilter: 'blur(8px)',
            pointerEvents: 'auto'
          }}>
            SCREEN SHARING
          </div>
        ) : <div />}

        {/* Pin / Unpin Button (Google Meet / Zoom style) */}
        {onPin && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPin();
            }}
            className="btn btn-secondary btn-icon"
            style={{
              width: '32px',
              height: '32px',
              padding: 0,
              background: isPinned ? 'var(--accent-cyan)' : 'rgba(15, 23, 42, 0.75)',
              color: isPinned ? '#ffffff' : 'var(--text-primary)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(8px)',
              pointerEvents: 'auto',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title={isPinned ? 'Unpin to grid view' : 'Pin to large view'}
          >
            <Pin size={15} style={{ transform: isPinned ? 'rotate(45deg)' : 'none' }} />
          </button>
        )}
      </div>
    </div>
  );
}
