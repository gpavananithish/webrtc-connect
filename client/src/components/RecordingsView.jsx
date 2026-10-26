import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Film, Play, Download, Trash2, Calendar, Clock, HardDrive, X, Video 
} from 'lucide-react';

export default function RecordingsView() {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewRec, setPreviewRec] = useState(null);

  const fetchRecordings = () => {
    setLoading(true);
    api.getRecordings()
      .then(res => setRecordings(res.recordings || []))
      .catch(err => console.error('Failed to load recordings:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRecordings();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this meeting recording?')) {
      try {
        await api.deleteRecording(id);
        fetchRecordings();
        if (previewRec && previewRec.id === id) setPreviewRec(null);
      } catch (err) {
        alert(err.message || 'Failed to delete');
      }
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatSecs = (secs) => {
    if (!secs) return '0:00';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="responsive-page-pad" style={{ flex: 1, height: '100%', overflowY: 'auto', padding: '36px' }}>
      <div style={{ maxWidth: '940px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Meeting Recordings
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            Browse, play back, and download synchronized WebRTC session recordings.
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Loading recordings...
          </div>
        ) : recordings.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <Film size={44} color="rgba(6, 182, 212, 0.4)" style={{ marginBottom: '14px' }} />
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#ffffff', marginBottom: '4px' }}>
              No recordings saved yet
            </div>
            <p style={{ fontSize: '0.85rem' }}>
              Start a meeting and click "Record Meeting" to capture audio, video, and screen sharing streams.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '20px' }}>
            {recordings.map((rec) => (
              <div key={rec.id} className="glass-card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* Thumbnail / Header Box */}
                <div 
                  onClick={() => setPreviewRec(rec)}
                  style={{
                    height: '140px',
                    background: 'linear-gradient(135deg, #090d16 0%, #1e1b4b 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                >
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'rgba(6, 182, 212, 0.85)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'var(--accent-glow)'
                  }}>
                    <Play size={22} color="#ffffff" fill="#ffffff" style={{ marginLeft: '3px' }} />
                  </div>

                  {/* Duration Badge */}
                  <div style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '8px',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(0, 0, 0, 0.75)',
                    color: '#ffffff',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono)'
                  }}>
                    {formatSecs(rec.durationSeconds)}
                  </div>
                </div>

                {/* Details */}
                <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                    {rec.meetingTitle}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={13} />
                      <span>{new Date(rec.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <HardDrive size={13} />
                      <span>{formatFileSize(rec.filesize)}</span>
                    </div>
                    {rec.recordedBy && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>Recorded by {rec.recordedBy.name}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => setPreviewRec(rec)}
                      className="btn btn-primary"
                      style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem' }}
                    >
                      <Play size={14} fill="#ffffff" />
                      <span>Play</span>
                    </button>

                    <a
                      href={rec.url}
                      download={`meeting-${rec.id}.webm`}
                      className="btn btn-secondary btn-icon"
                      style={{ width: '36px', height: '36px' }}
                      title="Download WebM Video"
                    >
                      <Download size={15} />
                    </a>

                    <button
                      onClick={() => handleDelete(rec.id)}
                      className="btn btn-secondary btn-icon"
                      style={{ width: '36px', height: '36px', color: '#ef4444' }}
                      title="Delete recording"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Video Player Preview Modal */}
        {previewRec && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '24px'
          }}>
            <div className="glass-card" style={{
              width: '100%',
              maxWidth: '880px',
              overflow: 'hidden',
              background: '#090d16',
              border: '1px solid var(--border-medium)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)'
            }}>
              {/* Modal Header */}
              <div style={{
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-subtle)'
              }}>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>
                  {previewRec.meetingTitle}
                </div>
                <button
                  onClick={() => setPreviewRec(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Video Element */}
              <div style={{ background: '#000000', width: '100%', height: '480px' }}>
                <video
                  src={previewRec.url}
                  controls
                  autoPlay
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '12px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.8rem',
                color: 'var(--text-muted)'
              }}>
                <div>Recorded: {new Date(previewRec.createdAt).toLocaleString()}</div>
                <a
                  href={previewRec.url}
                  download={`recording-${previewRec.id}.webm`}
                  className="btn btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                >
                  <Download size={14} />
                  <span>Download WebM</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
