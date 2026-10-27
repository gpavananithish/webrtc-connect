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

  // Check if video is active: either isScreenSharing is true, or video is not muted and a video track is available/live
  const videoTracks = stream ? stream.getVideoTracks() : [];
  const videoTrack = videoTracks.length > 0 ? videoTracks[0] : null;
  const isTrackActive = videoTrack && videoTrack.readyState !== 'ended';
  const hasVideo = isScreenSharing ? (isLocal ? !!stream : true) : (!isVideoMuted && isTrackActive);

  // Keep videoRef.current srcObject up to date
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (stream && hasVideo) {
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
      videoEl.play().catch(e => {
        // Autoplay may be interrupted or require user interaction; handled gracefully
      });
    } else {
      videoEl.srcObject = null;
    }
  }, [stream, hasVideo]);

  // Listen to track unmute/ended events to trigger re-renders
  const [, setTrackStateTick] = React.useState(0);
  useEffect(() => {
    if (!stream) return;
    const handleTrackChange = () => setTrackStateTick(t => t + 1);
    stream.getTracks().forEach(t => {
      t.addEventListener('unmute', handleTrackChange);
      t.addEventListener('mute', handleTrackChange);
      t.addEventListener('ended', handleTrackChange);
    });
    return () => {
      stream.getTracks().forEach(t => {
        t.removeEventListener('unmute', handleTrackChange);
        t.removeEventListener('mute', handleTrackChange);
        t.removeEventListener('ended', handleTrackChange);
      });
    };
  }, [stream]);

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
        <div style={{
          textAlign: 'center',
          zIndex: 5,
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%'
        }}>
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: '12px' }}>
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user?.displayName || 'User'}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.style.display = 'none';
                  const fallbackInitials = e.target.parentNode.querySelector('.tile-initials-fallback');
                  if (fallbackInitials) fallbackInitials.style.display = 'flex';
                }}
                style={{
                  width: '84px',
                  height: '84px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: isSpeaking ? '3px solid var(--accent-cyan)' : '3px solid var(--border-medium)',
                  boxShadow: isSpeaking ? '0 0 24px rgba(6, 182, 212, 0.45)' : 'var(--shadow-sm)'
                }}
              />
            ) : null}
            <div
              className="tile-initials-fallback"
              style={{
                width: '84px',
                height: '84px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-indigo) 100%)',
                color: '#ffffff',
                display: user?.avatar ? 'none' : 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                fontWeight: 800,
                border: isSpeaking ? '3px solid var(--accent-cyan)' : '3px solid rgba(255, 255, 255, 0.2)',
                boxShadow: isSpeaking ? '0 0 24px rgba(6, 182, 212, 0.45)' : 'var(--shadow-sm)'
              }}
            >
              {((user?.displayName || user?.username || 'U')[0]).toUpperCase()}
            </div>
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>
            {user?.displayName || user?.username || 'Participant'} {isLocal && '(You)'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-muted)' }} />
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
