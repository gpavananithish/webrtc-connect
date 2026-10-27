import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Video, Plus, UserCheck, Key, Shield, Clock, Film, ArrowRight, Camera, Mic } from 'lucide-react';

export default function MeetingLobby({ onStartMeeting }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('join'); // 'join' | 'create' | 'history'
  const [meetingCode, setMeetingCode] = useState('');
  const [password, setPassword] = useState('');
  const [title, setTitle] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(6);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Media preview state
  const [previewStream, setPreviewStream] = useState(null);
  const [isPreviewActive, setIsPreviewActive] = useState(false);
  const previewVideoRef = useRef(null);

  const startPreview = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      setPreviewStream(stream);
      setIsPreviewActive(true);
    } catch (err) {
      console.warn('Lobby camera preview error:', err);
    }
  };

  useEffect(() => {
    if (isPreviewActive && previewStream && previewVideoRef.current) {
      previewVideoRef.current.srcObject = previewStream;
      previewVideoRef.current.play().catch(e => console.log('Lobby preview play notice:', e));
    }
  }, [isPreviewActive, previewStream]);

  const stopPreview = () => {
    if (previewStream) {
      previewStream.getTracks().forEach(t => t.stop());
      setPreviewStream(null);
    }
    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = null;
    }
    setIsPreviewActive(false);
  };

  useEffect(() => {
    // Fetch meeting history
    api.getMeetingHistory()
      .then(res => setHistory(res.meetings || []))
      .catch(() => {});

    return () => {
      // Immediately stop all media tracks when switching away from Meetings tab
      if (previewStream) {
        previewStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [previewStream]);

  // Clean meeting code or direct link (e.g. https://.../?meeting=abc-defg-hij or abc-defg-hij)
  const extractMeetingCode = (input) => {
    if (!input) return '';
    const trimmed = input.trim();
    try {
      if (trimmed.includes('http://') || trimmed.includes('https://') || trimmed.includes('?meeting=')) {
        const urlObj = new URL(trimmed.startsWith('http') ? trimmed : `https://dummy.com/${trimmed}`);
        const codeParam = urlObj.searchParams.get('meeting');
        if (codeParam) return codeParam.toLowerCase();
        // Or extract last path segment
        const parts = urlObj.pathname.split('/').filter(Boolean);
        if (parts.length > 0) return parts[parts.length - 1].toLowerCase();
      }
    } catch (e) {}
    return trimmed.toLowerCase();
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    const rawInput = meetingCode.trim();
    if (!rawInput) return;
    setError('');
    setLoading(true);

    try {
      const code = extractMeetingCode(rawInput);
      const res = await api.validateMeeting(code, password);

      // Clean preview stream before launching meeting
      if (previewStream) {
        previewStream.getTracks().forEach(t => t.stop());
      }

      onStartMeeting(code, password);
    } catch (err) {
      setError(err.message || 'Failed to join meeting. Please verify meeting code or link.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.createMeeting({
        title: title.trim() || `${user.displayName}'s Meeting`,
        password: password.trim() || null,
        maxParticipants
      });

      if (previewStream) {
        previewStream.getTracks().forEach(t => t.stop());
      }

      onStartMeeting(res.meeting.code, password.trim() || null);
    } catch (err) {
      setError(err.message || 'Failed to create meeting');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="responsive-page-pad" style={{
      flex: 1,
      height: '100%',
      overflowY: 'auto',
      padding: '36px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <div style={{ width: '100%', maxWidth: '840px' }}>
        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Video Meetings & Conferences
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Host or join secure peer-to-peer mesh meetings with screen sharing, in-meeting chat, and full recording.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="tab-pill-container" style={{
          display: 'flex',
          background: 'var(--bg-card)',
          padding: '4px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          width: 'fit-content',
          maxWidth: '100%',
          overflowX: 'auto',
          marginBottom: '28px'
        }}>
          <button
            onClick={() => { setActiveTab('join'); setError(''); }}
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: activeTab === 'join' ? 'var(--accent-gradient)' : 'transparent',
              color: activeTab === 'join' ? '#ffffff' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Join with Code
          </button>
          <button
            onClick={() => { setActiveTab('create'); setError(''); }}
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: activeTab === 'create' ? 'var(--accent-gradient)' : 'transparent',
              color: activeTab === 'create' ? '#ffffff' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Create New Meeting
          </button>
          <button
            onClick={() => { setActiveTab('history'); setError(''); }}
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: activeTab === 'history' ? 'var(--accent-gradient)' : 'transparent',
              color: activeTab === 'history' ? '#ffffff' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Meeting History
          </button>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.85rem',
            marginBottom: '24px'
          }}>
            {error}
          </div>
        )}

        {/* Tab 1: Join Meeting */}
        {activeTab === 'join' && (
          <div className="responsive-grid-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            <div className="glass-card" style={{ padding: '28px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '6px' }}>Join a Meeting</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Paste the meeting link or enter the 9-letter code.
              </p>

              <form onSubmit={handleJoin}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Meeting Link or Code
                  </label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    placeholder="Paste link or code (e.g. abc-defg-hij)"
                    value={meetingCode}
                    onChange={(e) => setMeetingCode(e.target.value)}
                  />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Password (If required)
                  </label>
                  <input
                    type="password"
                    className="input-field"
                    placeholder="Leave blank if none"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !meetingCode.trim()}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '12px' }}
                >
                  <ArrowRight size={18} />
                  <span>{loading ? 'Verifying...' : 'Join Room'}</span>
                </button>
              </form>
            </div>

            {/* Camera Preview Card */}
            <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, color: 'var(--text-secondary)' }}>
                  Media Device Check
                </h3>
                <button
                  type="button"
                  onClick={isPreviewActive ? stopPreview : startPreview}
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                >
                  <Camera size={13} color="var(--accent-cyan)" />
                  <span>{isPreviewActive ? 'Turn Off Preview' : 'Preview Camera'}</span>
                </button>
              </div>

              <div style={{
                flex: 1,
                minHeight: '220px',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                background: '#0a0f1d',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border-subtle)'
              }}>
                {isPreviewActive ? (
                  <video
                    ref={previewVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                    <Camera size={36} color="rgba(255, 255, 255, 0.2)" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '0.85rem' }}>Camera is idle</div>
                    <div style={{ fontSize: '0.72rem', marginTop: '4px' }}>Click "Preview Camera" to test before joining</div>
                  </div>
                )}
                {isPreviewActive && (
                  <div style={{
                    position: 'absolute',
                    bottom: '10px',
                    left: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(0, 0, 0, 0.6)',
                    fontSize: '0.75rem',
                    color: '#ffffff'
                  }}>
                    <Camera size={14} color="var(--accent-cyan)" />
                    <span>Camera Active</span>
                  </div>
                )}
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '12px' }}>
                Your camera and microphone will be enabled upon entering the room. You can mute at any time.
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: Create Meeting */}
        {activeTab === 'create' && (
          <div className="glass-card" style={{ padding: '32px', maxWidth: '560px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '6px' }}>Create Instant Meeting</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Set up a new WebRTC room. A unique shareable code will be created automatically.
            </p>

            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Meeting Title
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder={`e.g. ${user.displayName}'s Standup`}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Meeting Password (Optional)
                </label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Protect meeting with a passcode"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '28px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Participant Limit (Mesh topology limit)
                </label>
                <select
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(parseInt(e.target.value, 10))}
                  className="input-field"
                  style={{ cursor: 'pointer' }}
                >
                  <option value={2} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>2 Participants (1-on-1)</option>
                  <option value={4} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>4 Participants (Recommended for Mesh)</option>
                  <option value={6} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>6 Participants (Max Mesh Limit)</option>
                </select>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Note: P2P mesh topology sends separate streams to each participant. 4-6 is optimal.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px' }}
              >
                <Plus size={18} />
                <span>{loading ? 'Creating...' : 'Start Meeting Now'}</span>
              </button>
            </form>
          </div>
        )}

        {/* Tab 3: History */}
        {activeTab === 'history' && (
          <div className="glass-card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '18px' }}>Recent Meetings</h2>
            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                No past meetings recorded yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {history.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 18px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {m.title}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Code: <strong style={{ color: 'var(--accent-cyan)' }}>{m.code}</strong>
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Host: {m.hostName}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {new Date(m.startedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {m.recordingCount > 0 && (
                        <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>
                          <Film size={12} /> {m.recordingCount} Recording
                        </span>
                      )}
                      {m.isActive ? (
                        <button
                          onClick={() => {
                            if (previewStream) previewStream.getTracks().forEach(t => t.stop());
                            onStartMeeting(m.code, null);
                          }}
                          className="btn btn-primary"
                          style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                        >
                          Rejoin
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ended</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
