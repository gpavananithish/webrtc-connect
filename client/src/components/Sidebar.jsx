import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSignaling } from '../context/SignalingContext';
import { useTheme } from '../context/ThemeContext';
import { 
  MessageSquare, Users, PhoneCall, Video, Film, Settings, 
  LogOut, ChevronDown, Check, Wifi, WifiOff, Sun, Moon 
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, unreadTotal = 0 }) {
  const { user, logout, updateStatus } = useAuth();
  const { isConnected } = useSignaling();
  const { theme, toggleTheme, isDark } = useTheme();
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const navItems = [
    { id: 'chats', label: 'Chats', icon: MessageSquare, badge: unreadTotal },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'calls', label: 'Calls', icon: PhoneCall },
    { id: 'meetings', label: 'Meetings', icon: Video },
    { id: 'recordings', label: 'Recordings', icon: Film },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const statuses = [
    { id: 'online', label: 'Available', dotClass: 'online' },
    { id: 'busy', label: 'In a Call / Busy', dotClass: 'busy' },
    { id: 'away', label: 'Away', dotClass: 'away' },
    { id: 'offline', label: 'Appear Offline', dotClass: 'offline' }
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="mobile-hide" style={{
        width: '260px',
        height: '100vh',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        userSelect: 'none',
        transition: 'background-color 0.25s ease, border-color 0.25s ease'
      }}>
      {/* Brand Header */}
      <div style={{
        padding: '24px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '12px',
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--accent-glow)'
          }}>
            <Video size={20} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Connect
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              Native WebRTC Suite
            </div>
          </div>
        </div>

        {/* Signaling indicator */}
        <div 
          title={isConnected ? 'Signaling Server Connected' : 'Signaling Reconnecting...'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            borderRadius: 'var(--radius-full)',
            background: isConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${isConnected ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`
          }}
        >
          {isConnected ? (
            <Wifi size={12} color="var(--status-online)" />
          ) : (
            <WifiOff size={12} color="var(--status-busy)" />
          )}
          <span style={{ fontSize: '0.65rem', fontWeight: 600, color: isConnected ? 'var(--status-online)' : 'var(--status-busy)' }}>
            {isConnected ? 'LIVE' : 'SYNC'}
          </span>
        </div>
      </div>

      {/* Navigation List */}
      <nav style={{ padding: '16px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: isActive ? 'var(--accent-gradient)' : 'transparent',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                width: '100%',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'var(--nav-hover-bg)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Icon size={18} color={isActive ? '#ffffff' : 'currentColor'} />
                <span>{item.label}</span>
              </div>
              {item.badge > 0 && (
                <span style={{
                  background: isActive ? 'rgba(0, 0, 0, 0.25)' : 'var(--accent-cyan)',
                  color: '#ffffff',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 'var(--radius-full)'
                }}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Quick Theme Switcher Button */}
      <div style={{ padding: '0 12px 12px 12px' }}>
        <button
          onClick={toggleTheme}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--btn-secondary-bg)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--btn-secondary-hover)';
            e.currentTarget.style.borderColor = 'var(--border-medium)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--btn-secondary-bg)';
            e.currentTarget.style.borderColor = 'var(--border-subtle)';
          }}
          title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isDark ? (
              <Moon size={16} color="var(--accent-cyan)" />
            ) : (
              <Sun size={16} color="#d97706" />
            )}
            <span>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
          </div>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.68rem',
            fontWeight: 700,
            color: 'var(--text-accent)',
            padding: '3px 8px',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(6, 182, 212, 0.12)'
          }}>
            {isDark ? 'LIGHT' : 'DARK'}
          </div>
        </button>
      </div>

      {/* Current User Badge & Status Selector */}
      <div style={{
        padding: '16px',
        borderTop: '1px solid var(--border-subtle)',
        position: 'relative'
      }}>
        {showStatusMenu && (
          <div className="glass-card" style={{
            position: 'absolute',
            bottom: '76px',
            left: '12px',
            right: '12px',
            padding: '8px',
            zIndex: 100
          }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', padding: '6px 8px', textTransform: 'uppercase' }}>
              Change Status
            </div>
            {statuses.map(st => (
              <button
                key={st.id}
                onClick={() => {
                  updateStatus(st.id);
                  setShowStatusMenu(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '8px 10px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--nav-hover-bg)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`status-dot ${st.dotClass}`} />
                  <span>{st.label}</span>
                </div>
                {user?.status === st.id && <Check size={14} color="var(--accent-cyan)" />}
              </button>
            ))}
          </div>
        )}

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--btn-secondary-bg)',
          border: '1px solid var(--border-subtle)'
        }}>
          <div 
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1, minWidth: 0 }}
          >
            <div style={{ position: 'relative' }}>
              <img
                src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user?.displayName || 'User')}`}
                alt={user?.displayName}
                style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
              />
              <span 
                className={`status-dot ${user?.status || 'online'}`}
                style={{
                  position: 'absolute',
                  bottom: '0',
                  right: '0',
                  border: '2px solid var(--bg-secondary)'
                }}
              />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user?.displayName}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user?.title || 'Team Member'}
              </div>
            </div>
            <ChevronDown size={14} color="var(--text-muted)" />
          </div>

          <button
            title="Sign Out"
            onClick={logout}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '6px',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>

    {/* Mobile Navigation Bar (Fixed Bottom on mobile screens) */}
    <div style={{
      display: 'none',
      width: '100%',
      height: '62px',
      background: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border-subtle)',
      position: 'relative',
      zIndex: 50,
      flexShrink: 0
    }} className="mobile-bottom-bar">
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        width: '100%',
        height: '100%',
        padding: '0 4px'
      }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)',
                padding: '6px 4px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                flex: 1
              }}
            >
              <div style={{ position: 'relative' }}>
                <Icon size={19} color={isActive ? 'var(--accent-cyan)' : 'currentColor'} />
                {item.badge > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '-7px',
                    background: 'var(--accent-cyan)',
                    color: '#ffffff',
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    padding: '1px 4px',
                    borderRadius: 'var(--radius-full)'
                  }}>
                    {item.badge}
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.65rem', fontWeight: isActive ? 700 : 500, marginTop: '2px' }}>
                {item.label}
              </span>
            </button>
          );
        })}
        {/* Quick Theme Switch in Mobile Bar */}
        <button
          onClick={toggleTheme}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            padding: '6px 4px',
            cursor: 'pointer',
            flex: 1
          }}
          title="Toggle Theme"
        >
          {isDark ? <Moon size={19} color="var(--accent-cyan)" /> : <Sun size={19} color="#d97706" />}
          <span style={{ fontSize: '0.65rem', fontWeight: 500, marginTop: '2px' }}>
            {isDark ? 'Dark' : 'Light'}
          </span>
        </button>
      </div>
    </div>
  </>
  );
}
