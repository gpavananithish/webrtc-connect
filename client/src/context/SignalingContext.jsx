import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { soundService } from '../services/soundService';

const SignalingContext = createContext(null);

export function SignalingProvider({ children }) {
  const { user, token } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const [incomingCall, setIncomingCall] = useState(null);

  const wsRef = useRef(null);
  const listenersRef = useRef(new Map());
  const reconnectTimeoutRef = useRef(null);

  // Send signaling message
  const sendSignaling = useCallback((type, payload = {}) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
      return true;
    } else {
      console.warn('Signaling socket not open. Cannot send:', type);
      return false;
    }
  }, []);

  // Event listener subscription
  const on = useCallback((type, callback) => {
    if (!listenersRef.current.has(type)) {
      listenersRef.current.set(type, new Set());
    }
    listenersRef.current.get(type).add(callback);
    return () => {
      if (listenersRef.current.has(type)) {
        listenersRef.current.get(type).delete(callback);
      }
    };
  }, []);

  const dispatchEvent = useCallback((type, data) => {
    if (listenersRef.current.has(type)) {
      listenersRef.current.get(type).forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error in signaling listener for ${type}:`, err);
        }
      });
    }
  }, []);

  // Accept incoming call
  const acceptIncomingCall = useCallback(() => {
    soundService.stopRingtone();
    if (incomingCall) {
      sendSignaling('call-accept', {
        callId: incomingCall.callId,
        targetUserId: incomingCall.caller.id
      });
      const callData = { ...incomingCall };
      setIncomingCall(null);
      return callData;
    }
    return null;
  }, [incomingCall, sendSignaling]);

  // Reject incoming call
  const rejectIncomingCall = useCallback((reason = 'Call declined') => {
    soundService.stopRingtone();
    if (incomingCall) {
      sendSignaling('call-reject', {
        callId: incomingCall.callId,
        targetUserId: incomingCall.caller.id,
        reason
      });
      setIncomingCall(null);
    }
  }, [incomingCall, sendSignaling]);

  // Connect to WebSocket
  useEffect(() => {
    if (!token || !user) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    function connect() {
      const defaultProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const defaultHost = window.location.host;
      const wsUrl = import.meta.env.VITE_WS_URL || `${defaultProtocol}//${defaultHost}/ws`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        // Authenticate immediately
        sendSignaling('auth', { token });
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const { type, ...payload } = msg;

          switch (type) {
            case 'auth-success':
              if (Array.isArray(payload.onlineUserIds)) {
                setOnlineUserIds(new Set(payload.onlineUserIds));
              }
              break;

            case 'user-status-changed':
              setOnlineUserIds((prev) => {
                const next = new Set(prev);
                if (payload.status === 'online') {
                  next.add(payload.userId);
                } else {
                  next.delete(payload.userId);
                }
                return next;
              });
              break;

            case 'incoming-call':
              soundService.playRingtone();
              setIncomingCall({
                callId: payload.callId,
                callType: payload.callType,
                caller: payload.caller
              });
              break;

            case 'call-rejected':
            case 'call-ended':
              soundService.stopRingtone();
              soundService.stopRingback();
              if (incomingCall && incomingCall.callId === payload.callId) {
                setIncomingCall(null);
              }
              break;

            case 'new-chat-message':
              soundService.playMessageSound();
              break;

            default:
              break;
          }

          // Dispatch event to local subscribers
          dispatchEvent(type, payload);
        } catch (e) {
          console.error('Failed to parse signaling message:', e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        soundService.stopRingtone();
        soundService.stopRingback();
        // Reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.error('Signaling WebSocket error:', err);
        ws.close();
      };
    }

    connect();

    return () => {
      soundService.stopRingtone();
      soundService.stopRingback();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [token, user, sendSignaling, dispatchEvent]);

  return (
    <SignalingContext.Provider
      value={{
        isConnected,
        onlineUserIds,
        incomingCall,
        sendSignaling,
        on,
        acceptIncomingCall,
        rejectIncomingCall
      }}
    >
      {children}
    </SignalingContext.Provider>
  );
}

export function useSignaling() {
  const context = useContext(SignalingContext);
  if (!context) {
    throw new Error('useSignaling must be used within a SignalingProvider');
  }
  return context;
}
