import { useState, useRef, useEffect, useCallback } from 'react';
import { useSignaling } from '../context/SignalingContext';
import { soundService } from '../services/soundService';
import { api } from '../services/api';

const DEFAULT_ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
];

export function useOneOnOneCall() {
  const { sendSignaling, on } = useSignaling();

  const [callState, setCallState] = useState('idle'); // 'idle' | 'calling' | 'ringing' | 'connected'
  const [callType, setCallType] = useState('video'); // 'audio' | 'video'
  const [remoteUser, setRemoteUser] = useState(null);
  const [callId, setCallId] = useState(null);
  const [callDuration, setCallDuration] = useState(0);

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [networkQuality, setNetworkQuality] = useState('good'); // 'good' | 'fair' | 'poor'

  const pcRef = useRef(null);
  const candidateQueueRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const statsIntervalRef = useRef(null);
  const originalVideoTrackRef = useRef(null);
  const screenStreamRef = useRef(null);
  const iceServersRef = useRef(DEFAULT_ICE_SERVERS);

  // Load configured ICE servers
  useEffect(() => {
    api.getIceServers()
      .then(res => {
        if (res && res.iceServers && res.iceServers.length > 0) {
          iceServersRef.current = res.iceServers;
        }
      })
      .catch(() => {});
  }, []);

  // Helper to create RTCPeerConnection
  const createPeerConnection = useCallback((targetUserId, currentCallId) => {
    if (pcRef.current) {
      pcRef.current.close();
    }

    const pc = new RTCPeerConnection({
      iceServers: iceServersRef.current
    });
    pcRef.current = pc;
    candidateQueueRef.current = [];

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignaling('call-ice-candidate', {
          callId: currentCallId,
          targetUserId,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallState('connected');
        soundService.stopRingback();
        soundService.stopRingtone();
        soundService.playCallConnected();
      } else if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
        if (callState === 'connected') {
          console.warn('PeerConnection disconnected or failed:', pc.connectionState);
        }
      }
    };

    return pc;
  }, [sendSignaling, callState]);

  // Helper to acquire user media with preferred device support and fallback
  const acquireMediaStream = async (type) => {
    const savedMic = localStorage.getItem('connect_preferred_mic');
    const savedCam = localStorage.getItem('connect_preferred_cam');

    const audioConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      ...(savedMic ? { deviceId: { ideal: savedMic } } : {})
    };

    const constraints = {
      audio: audioConstraints,
      video: type === 'video' ? (savedCam ? { deviceId: { ideal: savedCam } } : true) : false
    };

    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      console.warn('Exact/ideal device constraints failed, falling back to basic audio/video:', err);
      // Fallback to basic audio/video
      return await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video'
      });
    }
  };

  // Start outgoing call
  const startCall = useCallback(async (targetUser, type = 'video') => {
    const newCallId = 'call_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    setCallId(newCallId);
    setRemoteUser(targetUser);
    setCallType(type);
    setCallState('calling');
    setCallDuration(0);
    soundService.playRingback();

    try {
      const stream = await acquireMediaStream(type);
      setLocalStream(stream);

      const pc = createPeerConnection(targetUser.id, newCallId);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // Create offer
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await pc.setLocalDescription(offer);

      // Signal offer
      sendSignaling('call-request', {
        targetUserId: targetUser.id,
        callType: type,
        callId: newCallId
      });
    } catch (err) {
      console.error('Failed to start call:', err);
      soundService.stopRingback();
      setCallState('idle');
      alert(`Could not access media devices: ${err.message}. Please check camera and microphone permissions.`);
    }
  }, [createPeerConnection, sendSignaling]);

  // Answer incoming call
  const answerCall = useCallback(async (incomingCallData) => {
    const { callId: currentCallId, callType: type, caller } = incomingCallData;
    setCallId(currentCallId);
    setRemoteUser(caller);
    setCallType(type);
    setCallState('connecting');
    setCallDuration(0);

    try {
      const stream = await acquireMediaStream(type);
      setLocalStream(stream);

      const pc = createPeerConnection(caller.id, currentCallId);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      sendSignaling('call-accept', {
        callId: currentCallId,
        targetUserId: caller.id
      });
    } catch (err) {
      console.error('Failed to answer call:', err);
      sendSignaling('call-reject', {
        callId: currentCallId,
        targetUserId: caller.id,
        reason: 'Media device error on callee'
      });
      setCallState('idle');
      alert(`Could not access microphone/camera: ${err.message}. Please check permissions.`);
    }
  }, [createPeerConnection, sendSignaling]);

  // End active call
  const endCall = useCallback((remoteInitiated = false) => {
    soundService.stopRingback();
    soundService.stopRingtone();
    soundService.playCallEnded();

    if (!remoteInitiated && remoteUser && callId) {
      sendSignaling('call-end', {
        callId,
        targetUserId: remoteUser.id,
        durationSeconds: callDuration,
        callType
      });
    }

    // Stop all media tracks
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);

    setLocalStream(null);
    setRemoteStream(null);
    setCallState('idle');
    setRemoteUser(null);
    setCallId(null);
    setIsAudioMuted(false);
    setIsVideoMuted(false);
    setIsScreenSharing(false);
  }, [callId, remoteUser, callDuration, callType, localStream, sendSignaling]);

  // Toggle microphone
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  }, [localStream]);

  // Toggle camera
  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoMuted(!videoTrack.enabled);
      }
    }
  }, [localStream]);

  // Screen Sharing
  const toggleScreenShare = useCallback(async () => {
    if (!pcRef.current || callState !== 'connected') return;

    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        // Find current video sender
        const videoSender = pcRef.current.getSenders().find(s => s.track && s.track.kind === 'video');
        if (videoSender) {
          originalVideoTrackRef.current = videoSender.track;
          await videoSender.replaceTrack(screenTrack);
        }

        // When user stops sharing from browser toolbar
        screenTrack.onended = async () => {
          if (videoSender && originalVideoTrackRef.current) {
            await videoSender.replaceTrack(originalVideoTrackRef.current);
          }
          setIsScreenSharing(false);
        };

        setIsScreenSharing(true);
      } catch (err) {
        console.warn('Screen sharing cancelled or failed:', err);
      }
    } else {
      // Stop screen share and restore camera
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }
      const videoSender = pcRef.current.getSenders().find(s => s.track && s.track.kind === 'video');
      if (videoSender && originalVideoTrackRef.current) {
        await videoSender.replaceTrack(originalVideoTrackRef.current);
      }
      setIsScreenSharing(false);
    }
  }, [callState, isScreenSharing]);

  // Setup Signaling Listeners for 1-on-1 call
  useEffect(() => {
    const unsubAccepted = on('call-accepted', async () => {
      soundService.stopRingback();
      setCallState('connecting');
      // If we are caller, send our offer now that callee accepted
      if (pcRef.current && pcRef.current.localDescription) {
        sendSignaling('call-offer', {
          callId,
          targetUserId: remoteUser?.id,
          sdp: pcRef.current.localDescription
        });
      }
    });

    const unsubOffer = on('call-offer', async (payload) => {
      if (!pcRef.current) return;
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));

        // Flush any queued ICE candidates
        while (candidateQueueRef.current.length > 0) {
          const cand = candidateQueueRef.current.shift();
          await pcRef.current.addIceCandidate(cand);
        }

        // Create answer
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);

        sendSignaling('call-answer', {
          callId: payload.callId,
          targetUserId: payload.senderUserId,
          sdp: answer
        });
      } catch (err) {
        console.error('Failed to handle call-offer:', err);
      }
    });

    const unsubAnswer = on('call-answer', async (payload) => {
      if (!pcRef.current) return;
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));

        // Flush queued ICE candidates
        while (candidateQueueRef.current.length > 0) {
          const cand = candidateQueueRef.current.shift();
          await pcRef.current.addIceCandidate(cand);
        }
      } catch (err) {
        console.error('Failed to handle call-answer:', err);
      }
    });

    const unsubIce = on('call-ice-candidate', async (payload) => {
      if (!payload.candidate) return;
      const candidate = new RTCIceCandidate(payload.candidate);
      if (pcRef.current && pcRef.current.remoteDescription && pcRef.current.remoteDescription.type) {
        try {
          await pcRef.current.addIceCandidate(candidate);
        } catch (e) {
          console.warn('Error adding ICE candidate:', e);
        }
      } else {
        // Queue until remote description is set
        candidateQueueRef.current.push(candidate);
      }
    });

    const unsubRejected = on('call-rejected', (payload) => {
      soundService.stopRingback();
      soundService.playCallEnded();
      alert(`Call was rejected: ${payload.reason || 'User busy'}`);
      endCall(true);
    });

    const unsubEnded = on('call-ended', () => {
      endCall(true);
    });

    return () => {
      unsubAccepted();
      unsubOffer();
      unsubAnswer();
      unsubIce();
      unsubRejected();
      unsubEnded();
    };
  }, [on, sendSignaling, callId, remoteUser, endCall]);

  // Duration timer & Network stats monitor
  useEffect(() => {
    if (callState === 'connected') {
      timerIntervalRef.current = setInterval(() => {
        setCallDuration(d => d + 1);
      }, 1000);

      // Measure connection quality via getStats()
      statsIntervalRef.current = setInterval(async () => {
        if (pcRef.current) {
          try {
            const stats = await pcRef.current.getStats();
            let roundTripTime = 0;
            let packetsLost = 0;

            stats.forEach(report => {
              if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                roundTripTime = report.currentRoundTripTime || 0;
              }
              if (report.type === 'inbound-rtp' && report.kind === 'video') {
                packetsLost = report.packetsLost || 0;
              }
            });

            if (roundTripTime > 0.3 || packetsLost > 20) {
              setNetworkQuality('poor');
            } else if (roundTripTime > 0.1 || packetsLost > 5) {
              setNetworkQuality('fair');
            } else {
              setNetworkQuality('good');
            }
          } catch (e) {}
        }
      }, 3000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    };
  }, [callState]);

  return {
    callState,
    callType,
    remoteUser,
    callId,
    callDuration,
    localStream,
    remoteStream,
    isAudioMuted,
    isVideoMuted,
    isScreenSharing,
    networkQuality,
    startCall,
    answerCall,
    endCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare
  };
}
