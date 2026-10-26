import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  PhoneIncoming, PhoneOutgoing, PhoneMissed, Phone, Video, Clock 
} from 'lucide-react';

export default function CallHistoryView({ onStartCall }) {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getCallHistory()
      .then(res => setCalls(res.calls || []))
      .catch(err => console.error('Failed to load call history:', err))
      .finally(() => setLoading(false));
  }, []);

  const formatDuration = (secs) => {
    if (!secs) return '0s';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div className="responsive-page-pad" style={{ flex: 1, height: '100%', overflowY: 'auto', padding: '36px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Call History
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            Review past incoming, outgoing, and missed audio & video calls.
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Loading call logs...
          </div>
        ) : calls.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            No call history yet. Start a call with someone from Contacts or Chats!
          </div>
        ) : (
          <div className="glass-card" style={{ padding: '8px' }}>
            {calls.map((c) => {
              const isMissed = c.isMissed;
              const isOutgoing = c.direction === 'outgoing';

              return (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    borderBottom: '1px solid var(--border-subtle)',
                    transition: 'all 0.15s',
                    gap: '12px',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  {/* Left: Direction Icon & User Avatar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: isMissed ? 'rgba(239, 68, 68, 0.15)' : isOutgoing ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {isMissed ? (
                        <PhoneMissed size={16} color="#ef4444" />
                      ) : isOutgoing ? (
                        <PhoneOutgoing size={16} color="#3b82f6" />
                      ) : (
                        <PhoneIncoming size={16} color="#10b981" />
                      )}
                    </div>

                    <img
                      src={c.otherUser?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(c.otherUser?.displayName || 'User')}`}
                      alt={c.otherUser?.displayName}
                      style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                    />

                    <div style={{ minWidth: 0, overflow: 'hidden' }}>
                      <div style={{
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: isMissed ? '#f87171' : 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden'
                      }}>
                        {c.otherUser?.displayName}
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.72rem',
                        color: 'var(--text-muted)',
                        marginTop: '2px',
                        flexWrap: 'wrap',
                        overflow: 'hidden'
                      }}>
                        <span>{new Date(c.startedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                        <span>•</span>
                        <span style={{ textTransform: 'capitalize' }}>{c.callType}</span>
                        <span>•</span>
                        <span>{isMissed ? 'Missed' : formatDuration(c.durationSeconds)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Quick Redial */}
                  {c.otherUser && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <button
                        onClick={() => onStartCall(c.otherUser, c.callType)}
                        className="btn btn-secondary btn-icon"
                        style={{ width: '36px', height: '36px' }}
                        title={`Redial ${c.otherUser.displayName}`}
                      >
                        {c.callType === 'video' ? <Video size={15} /> : <Phone size={15} />}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
