import React from 'react';
import { useSignaling } from '../context/SignalingContext';
import { Phone, PhoneOff, Video, Mic } from 'lucide-react';

export default function IncomingCallModal({ onAcceptCall }) {
  const { incomingCall, rejectIncomingCall } = useSignaling();

  if (!incomingCall) return null;

  const isVideo = incomingCall.callType === 'video';

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(3, 7, 18, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      animation: 'fadeIn 0.25s ease'
    }}>
      <div className="glass-card recording-pulse" style={{
        width: '100%',
        maxWidth: '380px',
        padding: '36px 28px',
        textAlign: 'center',
        background: 'rgba(15, 23, 42, 0.92)',
        border: '1px solid rgba(6, 182, 212, 0.4)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 40px rgba(6, 182, 212, 0.2)'
      }}>
        {/* Pulsing Avatar */}
        <div style={{
          position: 'relative',
          width: '96px',
          height: '96px',
          margin: '0 auto 20px auto'
        }}>
          <img
            src={incomingCall.caller?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(incomingCall.caller?.displayName || 'User')}`}
            alt={incomingCall.caller?.displayName}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '3px solid var(--accent-cyan)'
            }}
          />
          <div style={{
            position: 'absolute',
            bottom: '2px',
            right: '2px',
            background: 'var(--accent-gradient)',
            borderRadius: '50%',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
          }}>
            {isVideo ? <Video size={14} color="#ffffff" /> : <Mic size={14} color="#ffffff" />}
          </div>
        </div>

        {/* Caller Info */}
        <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
          {incomingCall.caller?.displayName}
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
          {incomingCall.caller?.title || 'Team Member'}
        </p>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 14px',
          borderRadius: 'var(--radius-full)',
          background: 'rgba(6, 182, 212, 0.15)',
          border: '1px solid rgba(6, 182, 212, 0.3)',
          color: 'var(--accent-cyan)',
          fontSize: '0.8rem',
          fontWeight: 600,
          marginBottom: '32px'
        }}>
          <span>Incoming {isVideo ? 'Video' : 'Audio'} Call...</span>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '32px' }}>
          {/* Decline */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => rejectIncomingCall('Call declined by user')}
              className="btn btn-danger btn-icon"
              style={{ width: '56px', height: '56px' }}
              title="Decline Call"
            >
              <PhoneOff size={24} />
            </button>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Decline</span>
          </div>

          {/* Accept */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => onAcceptCall(incomingCall)}
              className="btn btn-success btn-icon"
              style={{ width: '56px', height: '56px' }}
              title="Accept Call"
            >
              <Phone size={24} />
            </button>
            <span style={{ fontSize: '0.75rem', color: 'var(--status-online)', fontWeight: 600 }}>Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
}
