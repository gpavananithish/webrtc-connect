import React, { useState, useEffect } from 'react';
import { useSignaling } from '../context/SignalingContext';
import { api } from '../services/api';
import { Search, Phone, Video, MessageSquare, Users, Shield } from 'lucide-react';

export default function ContactsView({ onStartCall, onStartChat }) {
  const { onlineUserIds } = useSignaling();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'online'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getUsers(search)
      .then(res => setUsers(res.users || []))
      .catch(err => console.error('Failed to fetch directory:', err))
      .finally(() => setLoading(false));
  }, [search]);

  const filteredUsers = users.filter(u => {
    const isOnline = onlineUserIds.has(u.id);
    if (filter === 'online' && !isOnline) return false;
    return true;
  });

  return (
    <div className="responsive-page-pad" style={{ flex: 1, height: '100%', overflowY: 'auto', padding: '36px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Employee Directory
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
              Connect instantly with team members via native WebRTC audio, video, or persistent messaging.
            </p>
          </div>

          <div className="tab-pill-container" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-card)',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)'
          }}>
            <button
              onClick={() => setFilter('all')}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: filter === 'all' ? 'var(--accent-gradient)' : 'transparent',
                color: filter === 'all' ? '#ffffff' : 'var(--text-muted)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              All ({users.length})
            </button>
            <button
              onClick={() => setFilter('online')}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: filter === 'online' ? 'var(--accent-gradient)' : 'transparent',
                color: filter === 'online' ? '#ffffff' : 'var(--text-muted)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Online ({users.filter(u => onlineUserIds.has(u.id)).length})
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: '28px' }}>
          <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '16px', top: '15px' }} />
          <input
            type="text"
            className="input-field"
            placeholder="Search colleagues by name, role, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '46px', paddingBottom: '12px', paddingTop: '12px' }}
          />
        </div>

        {/* Directory Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Loading directory...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            No team members matched your search.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {filteredUsers.map(colleague => {
              const isOnline = onlineUserIds.has(colleague.id);

              return (
                <div key={colleague.id} className="glass-card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                    <div style={{ position: 'relative' }}>
                      <img
                        src={colleague.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(colleague.displayName)}`}
                        alt={colleague.displayName}
                        style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <span
                        className={`status-dot ${isOnline ? 'online' : 'offline'}`}
                        style={{ position: 'absolute', bottom: '2px', right: '2px', border: '2px solid var(--bg-card)' }}
                      />
                    </div>

                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {colleague.displayName}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {colleague.title || 'Team Member'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: isOnline ? 'var(--status-online)' : 'var(--text-muted)', fontWeight: 500, marginTop: '2px' }}>
                        {isOnline ? 'Online now' : 'Offline'}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    <button
                      onClick={() => onStartChat(colleague.id)}
                      className="btn btn-secondary"
                      style={{ padding: '8px 0', fontSize: '0.75rem', flexDirection: 'column', gap: '4px' }}
                      title="Send instant message"
                    >
                      <MessageSquare size={16} />
                      <span>Chat</span>
                    </button>

                    <button
                      onClick={() => onStartCall(colleague, 'audio')}
                      className="btn btn-secondary"
                      style={{ padding: '8px 0', fontSize: '0.75rem', flexDirection: 'column', gap: '4px' }}
                      title="Start P2P Audio Call"
                    >
                      <Phone size={16} color="var(--accent-cyan)" />
                      <span>Audio</span>
                    </button>

                    <button
                      onClick={() => onStartCall(colleague, 'video')}
                      className="btn btn-primary"
                      style={{ padding: '8px 0', fontSize: '0.75rem', flexDirection: 'column', gap: '4px' }}
                      title="Start P2P Video Call"
                    >
                      <Video size={16} />
                      <span>Video</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
