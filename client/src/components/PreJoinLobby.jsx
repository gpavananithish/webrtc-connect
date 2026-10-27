import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { 
  Camera, CameraOff, Mic, MicOff, Settings, Shield, 
  ArrowRight, X, AlertCircle, Sparkles, CheckCircle2 
} from 'lucide-react';

export default function PreJoinLobby({
  initialCode = '',
  initialPassword = '',
  onJoin,
  onCancel
}) {
  const { user } = useAuth();
  
  const [meetingCode, setMeetingCode] = useState(initialCode);
  const [password, setPassword] = useState(initialPassword);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  
  // Audio & Video pre-join toggles
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [previewStream, setPreviewStream] = useState(null);
  const [hasPermissionError, setHasPermissionError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const videoRef = useRef(null);

  // Initialize preview stream
  useEffect(() => {
    let active = true;
    let streamInstance = null;

    async function initPreview() {
      try {
        setHasPermissionError(false);
        const savedMic = localStorage.getItem('connect_preferred_mic');
        const savedCam = localStorage.getItem('connect_preferred_cam');
        const videoConstraints = {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          aspectRatio: { ideal: 1.7777777778 }
        };
        if (savedCam) videoConstraints.deviceId = { ideal: savedCam };

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: savedMic ? { deviceId: { ideal: savedMic } } : true,
          video: videoConstraints
        });

        if (!active) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamInstance = stream;
        setPreviewStream(stream);

        // Apply initial toggle states
        const aTrack = stream.getAudioTracks()[0];
        if (aTrack) aTrack.enabled = isAudioEnabled;

        const vTrack = stream.getVideoTracks()[0];
        if (vTrack) vTrack.enabled = isVideoEnabled;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => console.log('PreJoin play note:', e));
        }
      } catch (err) {
        console.warn('PreJoin preview media error:', err);
        setHasPermissionError(true);
      }
    }

    initPreview();

    return () => {
      active = false;
      if (streamInstance) {
        streamInstance.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // Sync Audio Toggle with preview stream
  const toggleAudio = () => {
    const next = !isAudioEnabled;
    setIsAudioEnabled(next);
    if (previewStream) {
      const aTrack = previewStream.getAudioTracks()[0];
      if (aTrack) aTrack.enabled = next;
    }
  };

  // Sync Video Toggle with preview stream
  const toggleVideo = () => {
    const next = !isVideoEnabled;
    setIsVideoEnabled(next);
    if (previewStream) {
      const vTrack = previewStream.getVideoTracks()[0];
      if (vTrack) vTrack.enabled = next;
    }
  };

  // Clean meeting code or direct link (e.g. https://.../?meeting=abc-defg-hij or abc-defg-hij)
  const extractMeetingCode = (input) => {
    if (!input) return '';
    const trimmed = input.trim();
    try {
      if (trimmed.includes('http://') || trimmed.includes('https://') || trimmed.includes('?meeting=')) {
        const urlObj = new URL(trimmed.startsWith('http') ? trimmed : `https://dummy.com/${trimmed}`);
        const codeParam = urlObj.searchParams.get('meeting');
        if (codeParam) return codeParam.toLowerCase();
        const parts = urlObj.pathname.split('/').filter(Boolean);
        if (parts.length > 0) return parts[parts.length - 1].toLowerCase();
      }
    } catch (e) {}
    return trimmed.toLowerCase();
  };

  const handleJoinSubmit = async (e) => {
    e.preventDefault();
    const cleanCode = extractMeetingCode(meetingCode);
    if (!cleanCode) {
      setError('Please provide a valid meeting code or link');
      return;
    }
    const finalName = displayName.trim() || user?.displayName || 'Guest User';
    
    setError('');
    setLoading(true);

    try {
      // Validate meeting before joining
      await api.validateMeeting(cleanCode, password.trim() || null);

      // Clean preview stream before switching to active meeting room
      if (previewStream) {
        previewStream.getTracks().forEach(t => t.stop());
      }

      onJoin({
        code: cleanCode,
        password: password.trim() || null,
        displayName: finalName,
        audioEnabled: isAudioEnabled,
        videoEnabled: isVideoEnabled
      });
    } catch (err) {
      setError(err.message || 'Failed to join meeting. Please check the code or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'var(--bg-primary)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      overflowY: 'auto'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '920px',
        display: 'grid',
        gridTemplateColumns: 'minmax(320px, 1.25fr) minmax(300px, 1fr)',
        gap: '32px',
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border-medium)',
        boxShadow: 'var(--shadow-lg)',
        padding: '32px',
        position: 'relative'
      }}>
        {/* Cancel / Close button */}
        <button
          onClick={() => {
            if (previewStream) {
              previewStream.getTracks().forEach(t => t.stop());
            }
            if (onCancel) onCancel();
          }}
          className="btn btn-icon btn-secondary"
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            width: '36px',
            height: '36px'
          }}
          title="Cancel"
        >
          <X size={18} />
        </button>

        {/* Left Column: Live Camera & Mic Preview Box (Google Meet / Zoom style) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 10',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-md)'
          }}>
            {/* Live Video Preview */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)',
                display: isVideoEnabled && !hasPermissionError ? 'block' : 'none'
              }}
            />

            {/* Video Off Fallback Avatar */}
            {(!isVideoEnabled || hasPermissionError) && (
              <div style={{ textAlign: 'center', padding: '20px', zIndex: 2 }}>
                <img
                  src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName || 'User')}`}
                  alt={displayName}
                  style={{
                    width: '90px',
                    height: '90px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '3px solid var(--border-medium)',
                    marginBottom: '12px'
                  }}
                />
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {displayName || 'You'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {hasPermissionError ? 'Camera unavailable or blocked' : 'Camera is turned off'}
                </div>
              </div>
            )}

            {/* Floating Quick Action Mic & Cam Buttons (Zoom / Meet Style) */}
            <div style={{
              position: 'absolute',
              bottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              zIndex: 10
            }}>
              <button
                type="button"
                onClick={toggleAudio}
                className={`btn btn-icon ${!isAudioEnabled ? 'btn-danger' : 'btn-secondary'}`}
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  backdropFilter: 'blur(10px)',
                  boxShadow: 'var(--shadow-md)'
                }}
                title={isAudioEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
              >
                {isAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
              </button>

              <button
                type="button"
                onClick={toggleVideo}
                className={`btn btn-icon ${!isVideoEnabled ? 'btn-danger' : 'btn-secondary'}`}
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  backdropFilter: 'blur(10px)',
                  boxShadow: 'var(--shadow-md)'
                }}
                title={isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
              >
                {isVideoEnabled ? <Camera size={20} /> : <CameraOff size={20} />}
              </button>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.82rem',
            color: 'var(--text-secondary)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} color="var(--accent-cyan)" />
              <span>Devices ready: {isAudioEnabled ? 'Mic On' : 'Mic Off'}, {isVideoEnabled ? 'Cam On' : 'Cam Off'}</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Change in room anytime
            </span>
          </div>
        </div>

        {/* Right Column: Name, Password, and Ready to Join Form */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ marginBottom: '24px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(6, 182, 212, 0.1)',
              border: '1px solid rgba(6, 182, 212, 0.25)',
              color: 'var(--accent-cyan)',
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '10px'
            }}>
              <Sparkles size={13} />
              <span>Ready to Join?</span>
            </div>
            <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Meeting Preview
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Check your audio and video before entering the call. Set your name as it will appear to others.
            </p>
          </div>

          {error && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '18px'
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleJoinSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Display Name Input */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '6px'
              }}>
                Your Display Name
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="Enter your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                style={{ padding: '11px 14px', fontSize: '0.92rem' }}
              />
            </div>

            {/* Meeting Code / Link Input (Editable if entered lobby without code) */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '6px'
              }}>
                Meeting Code or Link
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. abc-defg-hij or invite link"
                value={meetingCode}
                onChange={(e) => setMeetingCode(e.target.value)}
                required
                style={{ padding: '11px 14px', fontSize: '0.92rem', fontFamily: 'var(--font-mono)' }}
              />
            </div>

            {/* Password input */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '6px'
              }}>
                Meeting Password <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
              </label>
              <input
                type="password"
                className="input-field"
                placeholder="Leave blank if no passcode"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ padding: '11px 14px', fontSize: '0.92rem' }}
              />
            </div>

            {/* Join Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '13px',
                fontSize: '1rem',
                fontWeight: 700,
                marginTop: '8px',
                borderRadius: 'var(--radius-lg)'
              }}
            >
              {loading ? 'Entering Room...' : 'Join Meeting Now'}
              <ArrowRight size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
