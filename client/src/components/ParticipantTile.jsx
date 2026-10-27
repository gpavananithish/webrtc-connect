import React, { useRef, useEffect } from 'react';
import { MicOff, Pin, User, ScreenShare } from 'lucide-react';

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

  // Accurate check if video track is present and enabled
  const videoTrack = stream && stream.getVideoTracks().length > 0 ? stream.getVideoTracks()[0] : null;
  const isTrackLive = videoTrack && videoTrack.readyState === 'live' && videoTrack.enabled;
  const hasVideo = isScreenSharing || (!isVideoMuted && isTrackLive);

  useEffect(() => {
    if (videoRef.current) {
      if (stream && hasVideo) {
        if (videoRef.current.srcObject !== stream) {
          videoRef.current.srcObject = stream;
        }
        videoRef.current.play().catch(e => console.log('Video play note:', e));
      } else {
        videoRef.current.srcObject = null;
      }
    }
  }, [stream, hasVideo]);

  return (
    <div 
      className={`glass-card ${isSpeaking ? 'speaking-active' : ''}`}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '200px',
        background: 'var(--bg-secondary)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius-lg)',
        border: isSpeaking ? '2px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)',
        transition: 'all 0.2s ease'
      }}
    >
      {/* Video Element - Only rendered and displayed when video is active */}
      {hasVideo && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal} // Always mute local video element to avoid echo
          style={{
            width: '100%',
            height: '100%',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: isScreenSharing ? 'contain' : (isPinned ? 'contain' : 'cover'),
            background: isScreenSharing ? '#000000' : 'transparent',
            display: 'block',
            transform: isLocal && !isScreenSharing ? 'scaleX(-1)' : 'none'
          }}
        />
      )}

      {/* Fallback Avatar when camera is disabled or stream has no video */}
      {!hasVideo && (
        <div style={{ textAlign: 'center', zIndex: 5, padding: '16px' }}>
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
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
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
        background: 'var(--bg-card)',
        backdropFilter: 'blur(8px)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)',
        zIndex: 10
      }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
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
        {/* Screen Sharing Presenter Banner (Zoom Style) */}
        {isScreenSharing ? (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 10px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(16, 185, 129, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#ffffff',
            fontSize: '0.74rem',
            fontWeight: 700,
            boxShadow: 'var(--shadow-sm)',
            backdropFilter: 'blur(8px)',
            pointerEvents: 'auto'
          }}>
            <ScreenShare size={14} />
            <span>{isLocal ? 'You are presenting' : `${user?.displayName || 'Participant'} is presenting`}</span>
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
              background: isPinned ? 'var(--accent-cyan)' : 'var(--bg-card)',
              color: isPinned ? '#ffffff' : 'var(--text-primary)',
              border: '1px solid var(--border-medium)',
              backdropFilter: 'blur(8px)',
              pointerEvents: 'auto',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
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
