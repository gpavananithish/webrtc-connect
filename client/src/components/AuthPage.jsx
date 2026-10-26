import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import { 
  LogIn, UserPlus, Shield, Sparkles, Video, Users, ArrowRight, Sun, Moon, Check, 
  MessageSquare, Radio, PhoneCall, Lock, Zap, CheckCircle2
} from 'lucide-react';

export default function AuthPage() {
  const { login, register } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const [isRegister, setIsRegister] = useState(false);
  const [demoUsers, setDemoUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [title, setTitle] = useState('');

  useEffect(() => {
    api.getDemoUsers()
      .then(res => setDemoUsers(res.users || []))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        await register({ email, password, displayName, title });
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoUser) => {
    setError('');
    setLoading(true);
    try {
      await login(demoUser.email, 'password123');
    } catch (err) {
      setError(err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  const signInFeatures = [
    { title: 'Peer-to-Peer WebRTC Mesh', desc: 'Direct, encrypted browser-to-browser voice & video with ultra-low latency.' },
    { title: 'Full Meeting Recordings', desc: 'Capture synchronized video, audio, and screen shares directly to storage.' },
    { title: 'Persistent Team Chat', desc: 'Rich messaging, real-time presence indicators, file sharing, and audio notes.' }
  ];

  const registerFeatures = [
    { title: 'Instant Account Setup', desc: 'No credit card or setup fee required. Start calling team members immediately.' },
    { title: 'Native HD Video & Audio', desc: 'Built-in noise suppression, echo cancellation, and screen share capabilities.' },
    { title: 'Adaptive Device Selection', desc: 'Switch seamlessly between headsets, external mics, and front/rear cameras.' }
  ];

  return (
    <div style={{
      width: '100vw',
      minHeight: '100vh',
      height: '100vh',
      overflowY: 'auto',
      overflowX: 'hidden',
      background: 'var(--bg-primary)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative'
    }}>
      {/* Top Floating Theme Switcher */}
      <header style={{
        padding: '16px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-secondary)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--accent-glow)'
          }}>
            <Video size={20} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Connect WebRTC
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              Native Peer-to-Peer Suite
            </div>
          </div>
        </div>

        <button
          onClick={toggleTheme}
          className="btn btn-secondary"
          style={{ padding: '6px 14px', fontSize: '0.78rem' }}
          title="Toggle Light / Dark Mode"
        >
          {isDark ? <Sun size={15} color="#d97706" /> : <Moon size={15} color="var(--accent-cyan)" />}
          <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </header>

      {/* Main Split-View Container (Left: Informational Banner, Right: Form) */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '1020px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
          margin: 'auto'
        }}>
          {/* Left Column: Contextual Info Banner */}
          <div className="glass-card" style={{
            padding: '36px 30px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: isDark 
              ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 27, 75, 0.4) 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-lg)'
          }}>
            <div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(6, 182, 212, 0.12)',
                color: 'var(--accent-cyan)',
                fontSize: '0.78rem',
                fontWeight: 700,
                marginBottom: '18px'
              }}>
                <Zap size={14} />
                <span>{isRegister ? 'New Member Onboarding' : 'Welcome Back'}</span>
              </div>

              <h2 style={{
                fontSize: '1.9rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
                lineHeight: 1.25,
                marginBottom: '14px'
              }}>
                {isRegister
                  ? 'Create your workspace profile and connect with teammates'
                  : 'Collaborate with your team via real-time WebRTC'}
              </h2>

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '28px' }}>
                {isRegister
                  ? 'Join the native collaboration platform. Experience high-definition peer-to-peer audio & video calls without third-party plugins.'
                  : 'Log in to access your direct chats, scheduled group meetings, call history logs, and synchronized recordings.'}
              </p>

              {/* Feature Highlights */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {(isRegister ? registerFeatures : signInFeatures).map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      background: 'rgba(6, 182, 212, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '2px'
                    }}>
                      <CheckCircle2 size={16} color="var(--accent-cyan)" />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {f.title}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45, marginTop: '2px' }}>
                        {f.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Status / Privacy Note */}
            <div style={{
              marginTop: '32px',
              paddingTop: '18px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.78rem',
              color: 'var(--text-muted)'
            }}>
              <Shield size={16} color="var(--status-online)" />
              <span>Native browser encryption & peer-to-peer security active</span>
            </div>
          </div>

          {/* Right Column: Scrollable Authentication Form Card */}
          <div className="glass-card" style={{
            padding: '32px 28px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            {/* Pill Tabs */}
            <div className="tab-pill-container" style={{
              display: 'flex',
              background: 'var(--bg-tertiary)',
              padding: '4px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '22px',
              border: '1px solid var(--border-subtle)'
            }}>
              <button
                type="button"
                onClick={() => { setIsRegister(false); setError(''); }}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: !isRegister ? 'var(--accent-gradient)' : 'transparent',
                  color: !isRegister ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: !isRegister ? '0 2px 8px rgba(6, 182, 212, 0.25)' : 'none'
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setIsRegister(true); setError(''); }}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: isRegister ? 'var(--accent-gradient)' : 'transparent',
                  color: isRegister ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: isRegister ? '0 2px 8px rgba(6, 182, 212, 0.25)' : 'none'
                }}
              >
                Create Account
              </button>
            </div>

            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.84rem',
                marginBottom: '18px',
                fontWeight: 500
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {isRegister && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Full Display Name
                    </label>
                    <input
                      type="text"
                      required
                      className="input-field"
                      placeholder="e.g. Nithish Kumar"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Job Title / Role
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. Senior Frontend Engineer"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  className="input-field"
                  placeholder="nithish@connect.local"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Password
                </label>
                <input
                  type="password"
                  required
                  className="input-field"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px', fontSize: '0.95rem', marginTop: '6px' }}
              >
                {loading ? 'Please wait...' : (isRegister ? 'Sign Up & Launch Workspace' : 'Sign In to Workspace')}
              </button>
            </form>

            {/* Quick 1-Click Demo Profiles */}
            {!isRegister && demoUsers.length > 0 && (
              <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                  <Sparkles size={15} color="var(--accent-cyan)" />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    1-Click Demo Test Accounts
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                  {demoUsers.slice(0, 4).map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      disabled={loading}
                      onClick={() => handleDemoLogin(u)}
                      className="item-card-hover"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 10px',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <img
                        src={u.avatar}
                        alt={u.displayName}
                        style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {u.displayName.split(' ')[0]}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          {u.title ? u.title.split(' ')[0] : 'Member'}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '10px', textAlign: 'center' }}>
                  Tip: Open an Incognito window to log in as another user and test real audio/video calling!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
