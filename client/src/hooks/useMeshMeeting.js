import { useState, useRef, useEffect, useCallback } from 'react';
import { useSignaling } from '../context/SignalingContext';
import { useAuth } from '../context/AuthContext';
import { soundService } from '../services/soundService';
import { api } from '../services/api';

const DEFAULT_ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
];

export function useMeshMeeting(initialMeetingCode, onMeetingEnded) {
  const { user } = useAuth();
  const { sendSignaling, on } = useSignaling();

  const [inMeeting, setInMeeting] = useState(false);
  const [meetingDetails, setMeetingDetails] = useState(null);
  const [participants, setParticipants] = useState([]); // Array of user objects
  const [remoteStreams, setRemoteStreams] = useState({}); // userId -> MediaStream
  const [localStream, setLocalStream] = useState(null);

  // Active meeting room code reference to always be in sync across closures & callbacks
  const currentRoomCodeRef = useRef(initialMeetingCode ? initialMeetingCode.trim().toLowerCase() : null);
  const localStreamRef = useRef(null);
  const onMeetingEndedRef = useRef(onMeetingEnded);

  useEffect(() => {
    onMeetingEndedRef.current = onMeetingEnded;
  }, [onMeetingEnded]);

  // Keep currentRoomCodeRef in sync when initialMeetingCode changes from parent
  useEffect(() => {
    if (initialMeetingCode) {
      currentRoomCodeRef.current = initialMeetingCode.trim().toLowerCase();
    }
  }, [initialMeetingCode]);

  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [participantStates, setParticipantStates] = useState({}); // userId -> { audioMuted, videoMuted, isScreenSharing }
  const [isRecording, setIsRecording] = useState(false);
  const [recordingBy, setRecordingBy] = useState(null);
  const [activeSpeakerId, setActiveSpeakerId] = useState(null);
  const [inMeetingMessages, setInMeetingMessages] = useState([]);

  // Mesh peer connections: userId -> RTCPeerConnection
  const peersRef = useRef(new Map());
  // Candidate queues: userId -> RTCIceCandidate[]
  const candidateQueuesRef = useRef(new Map());
  const screenStreamRef = useRef(null);
  const originalVideoTrackRef = useRef(null);
  const audioContextRef = useRef(null);
  const analysersRef = useRef(new Map()); // userId -> AnalyserNode
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

  // Setup audio level analyzer for active speaker detection
  const setupAudioAnalyzer = useCallback((userId, stream) => {
    if (!stream || stream.getAudioTracks().length === 0) return;
    try {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      analysersRef.current.set(userId, analyser);
    } catch (e) {
      console.warn('Could not setup audio analyser for user:', userId, e);
    }
  }, []);

  // Monitor active speaker across all streams
  useEffect(() => {
    if (!inMeeting) return;

    const interval = setInterval(() => {
      let maxVol = 0;
      let loudestSpeaker = null;

      for (const [userId, analyser] of analysersRef.current.entries()) {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;

        if (avg > 25 && avg > maxVol) {
          maxVol = avg;
          loudestSpeaker = userId;
        }
      }

      if (loudestSpeaker) {
        setActiveSpeakerId(loudestSpeaker);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [inMeeting]);

  // Create RTCPeerConnection for a remote peer in mesh
  const createPeerConnection = useCallback((remoteUserId, currentLocalStream) => {
    if (peersRef.current.has(remoteUserId)) {
      try {
        peersRef.current.get(remoteUserId).close();
      } catch (e) {}
    }

    const effectiveStream = currentLocalStream || localStreamRef.current;

    const pc = new RTCPeerConnection({
      iceServers: iceServersRef.current
    });
    peersRef.current.set(remoteUserId, pc);
    candidateQueuesRef.current.set(remoteUserId, []);

    // Send local tracks
    if (effectiveStream) {
      effectiveStream.getTracks().forEach(track => {
        pc.addTrack(track, effectiveStream);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && currentRoomCodeRef.current) {
        sendSignaling('meeting-ice-candidate', {
          meetingCode: currentRoomCodeRef.current,
          targetUserId: remoteUserId,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        const stream = event.streams[0];
        setRemoteStreams(prev => ({
          ...prev,
          [remoteUserId]: stream
        }));
        setupAudioAnalyzer(remoteUserId, stream);
      }
    };

    return pc;
  }, [sendSignaling, setupAudioAnalyzer]);

  // Join meeting room
  const joinMeeting = useCallback(async (code, userInfo, password = null, initialMediaOptions = { audioEnabled: true, videoEnabled: true }) => {
    try {
      const cleanCode = (code || '').trim().toLowerCase();
      currentRoomCodeRef.current = cleanCode;

      // Validate with backend first
      const valRes = await api.validateMeeting(cleanCode, password);
      setMeetingDetails(valRes.meeting);

      // Acquire local media with preferred devices and mobile fallback
      let stream = null;
      const savedMic = localStorage.getItem('connect_preferred_mic');
      const savedCam = localStorage.getItem('connect_preferred_cam');

      try {
        const videoConstraints = {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          aspectRatio: { ideal: 1.7777777778 }
        };
        if (savedCam) videoConstraints.deviceId = { ideal: savedCam };

        stream = await navigator.mediaDevices.getUserMedia({
          audio: savedMic ? { deviceId: { ideal: savedMic } } : true,
          video: videoConstraints
        });
      } catch (e) {
        console.warn('Preferred media constraints failed, trying basic getUserMedia:', e);
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        } catch (audioVideoErr) {
          console.warn('Video failed on mobile, attempting audio only:', audioVideoErr);
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        }
      }

      // Apply initial audio & video toggle states from pre-join lobby
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack && initialMediaOptions.audioEnabled === false) {
        audioTrack.enabled = false;
        setIsAudioMuted(true);
      } else {
        setIsAudioMuted(false);
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && initialMediaOptions.videoEnabled === false) {
        videoTrack.enabled = false;
        setIsVideoMuted(true);
      } else {
        setIsVideoMuted(false);
      }

      localStreamRef.current = stream;
      setLocalStream(stream);
      setupAudioAnalyzer(user.id, stream);

      // Send join signal to room with customized user display name if provided
      const finalUserInfo = userInfo ? { ...user, ...userInfo } : user;
      sendSignaling('join-meeting', {
        meetingCode: cleanCode,
        userInfo: finalUserInfo
      });

      // Send initial track state
      sendSignaling('meeting-track-state', {
        meetingCode: cleanCode,
        audioMuted: initialMediaOptions.audioEnabled === false,
        videoMuted: initialMediaOptions.videoEnabled === false,
        isScreenSharing: false
      });

      setInMeeting(true);
      soundService.playCallConnected();
    } catch (err) {
      console.error('Failed to join meeting:', err);
      alert(`Join failed: ${err.message}`);
    }
  }, [sendSignaling, user, setupAudioAnalyzer]);

  // Internal helper to tear down peers and local tracks
  const cleanupMeetingResources = useCallback(() => {
    for (const [pId, pc] of peersRef.current.entries()) {
      try { pc.close(); } catch (e) {}
    }
    peersRef.current.clear();
    candidateQueuesRef.current.clear();
    analysersRef.current.clear();

    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (e) {}
      audioContextRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }

    setLocalStream(null);
    setRemoteStreams({});
    setParticipants([]);
    setInMeeting(false);
    setIsRecording(false);
    setRecordingBy(null);
    setInMeetingMessages([]);
    currentRoomCodeRef.current = null;

    if (onMeetingEndedRef.current) {
      onMeetingEndedRef.current();
    }
  }, []);

  // Leave meeting room (for individual participant)
  const leaveMeeting = useCallback(() => {
    const code = currentRoomCodeRef.current;
    if (code) {
      sendSignaling('leave-meeting', { meetingCode: code });
    }
    cleanupMeetingResources();
  }, [cleanupMeetingResources, sendSignaling]);

  // Host ends meeting for everyone in the room (Zoom style)
  const endMeetingForEveryone = useCallback(() => {
    const code = currentRoomCodeRef.current;
    if (code) {
      sendSignaling('end-meeting-all', { meetingCode: code });
    }
    cleanupMeetingResources();
  }, [cleanupMeetingResources, sendSignaling]);

  // Toggle local audio mute
  const toggleAudio = useCallback(() => {
    const stream = localStreamRef.current;
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
        if (currentRoomCodeRef.current) {
          sendSignaling('meeting-track-state', {
            meetingCode: currentRoomCodeRef.current,
            audioMuted: !audioTrack.enabled,
            videoMuted: isVideoMuted,
            isScreenSharing
          });
        }
      }
    }
  }, [isVideoMuted, isScreenSharing, sendSignaling]);

  // Toggle local video mute
  const toggleVideo = useCallback(() => {
    const stream = localStreamRef.current;
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoMuted(!videoTrack.enabled);
        if (currentRoomCodeRef.current) {
          sendSignaling('meeting-track-state', {
            meetingCode: currentRoomCodeRef.current,
            audioMuted: isAudioMuted,
            videoMuted: !videoTrack.enabled,
            isScreenSharing
          });
        }
      }
    }
  }, [isAudioMuted, isScreenSharing, sendSignaling]);

  const [screenStream, setScreenStream] = useState(null);

  // Screen sharing in meeting
  const toggleScreenShare = useCallback(async () => {
    if (!inMeeting) return;

    if (!isScreenSharing) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always',
            displaySurface: 'monitor'
          },
          audio: false
        });
        screenStreamRef.current = stream;
        setScreenStream(stream);
        const screenTrack = stream.getVideoTracks()[0];

        // Replace or add track on all existing peer connections
        for (const [pId, pc] of peersRef.current.entries()) {
          const videoSender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (videoSender) {
            originalVideoTrackRef.current = videoSender.track;
            await videoSender.replaceTrack(screenTrack);
          } else {
            // If peer connection had no video sender, add the screen track and renegotiate
            pc.addTrack(screenTrack, stream);
            try {
              const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
              await pc.setLocalDescription(offer);
              if (currentRoomCodeRef.current) {
                sendSignaling('meeting-offer', {
                  meetingCode: currentRoomCodeRef.current,
                  targetUserId: pId,
                  sdp: offer
                });
              }
            } catch (negErr) {
              console.warn('Renegotiation offer error during screen share:', negErr);
            }
          }
        }

        screenTrack.onended = async () => {
          for (const [pId, pc] of peersRef.current.entries()) {
            const videoSender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
            if (videoSender && originalVideoTrackRef.current) {
              await videoSender.replaceTrack(originalVideoTrackRef.current);
            }
          }
          if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(t => t.stop());
            screenStreamRef.current = null;
          }
          setScreenStream(null);
          setIsScreenSharing(false);
          if (currentRoomCodeRef.current) {
            sendSignaling('meeting-track-state', {
              meetingCode: currentRoomCodeRef.current,
              audioMuted: isAudioMuted,
              videoMuted: isVideoMuted,
              isScreenSharing: false
            });
          }
        };

        setIsScreenSharing(true);
        if (currentRoomCodeRef.current) {
          sendSignaling('meeting-track-state', {
            meetingCode: currentRoomCodeRef.current,
            audioMuted: isAudioMuted,
            videoMuted: false, // Ensure video is active during screen share
            isScreenSharing: true
          });
        }
      } catch (err) {
        console.warn('Screen share cancelled or failed:', err);
      }
    } else {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }
      setScreenStream(null);
      for (const [pId, pc] of peersRef.current.entries()) {
        const videoSender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (videoSender && originalVideoTrackRef.current) {
          await videoSender.replaceTrack(originalVideoTrackRef.current);
        }
      }
      setIsScreenSharing(false);
      if (currentRoomCodeRef.current) {
        sendSignaling('meeting-track-state', {
          meetingCode: currentRoomCodeRef.current,
          audioMuted: isAudioMuted,
          videoMuted: isVideoMuted,
          isScreenSharing: false
        });
      }
    }
  }, [inMeeting, isScreenSharing, isAudioMuted, isVideoMuted, sendSignaling]);

  // Set recording state notification
  const broadcastRecordingState = useCallback((recording, hostUser) => {
    setIsRecording(recording);
    setRecordingBy(recording ? hostUser : null);
    if (currentRoomCodeRef.current) {
      sendSignaling('meeting-recording-status', {
        meetingCode: currentRoomCodeRef.current,
        isRecording: recording,
        startedBy: hostUser
      });
    }
  }, [sendSignaling]);

  // Send in-meeting chat message (Supports 'everyone' or specific recipient for direct personal chat)
  const sendMeetingChat = useCallback((text, recipientUserId = 'everyone') => {
    if (!text.trim() || !currentRoomCodeRef.current) return;
    sendSignaling('meeting-chat-message', {
      meetingCode: currentRoomCodeRef.current,
      messageText: text.trim(),
      recipientUserId: recipientUserId || 'everyone'
    });
  }, [sendSignaling]);

  // Setup Signaling Event Listeners for Group Meeting
  useEffect(() => {
    // We joined and received existing participants in the room
    const unsubJoined = on('meeting-joined', async (payload) => {
      const existing = payload.participants || [];
      setParticipants(existing);

      const roomCode = payload.meetingCode || currentRoomCodeRef.current;
      if (roomCode) {
        currentRoomCodeRef.current = roomCode.trim().toLowerCase();
      }

      // Create an offer to each existing participant in the room
      for (const remoteUser of existing) {
        try {
          const pc = createPeerConnection(remoteUser.id, localStreamRef.current);
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
          });
          await pc.setLocalDescription(offer);

          sendSignaling('meeting-offer', {
            meetingCode: currentRoomCodeRef.current,
            targetUserId: remoteUser.id,
            sdp: offer
          });
        } catch (err) {
          console.error(`Failed to initiate offer to peer ${remoteUser.id}:`, err);
        }
      }
    });

    // A new user joined our room
    const unsubUserJoined = on('meeting-user-joined', async (payload) => {
      setParticipants(prev => {
        if (prev.some(p => p.id === payload.user.id)) return prev;
        return [...prev, payload.user];
      });

      // Also ensure we have a peer connection prepared for the new joiner
      if (!peersRef.current.has(payload.user.id) && localStreamRef.current) {
        createPeerConnection(payload.user.id, localStreamRef.current);
      }
    });

    // Received offer from a peer
    const unsubOffer = on('meeting-offer', async (payload) => {
      const { senderUserId, sdp } = payload;
      try {
        const pc = createPeerConnection(senderUserId, localStreamRef.current);
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));

        // Flush any queued ICE candidates for this peer
        const queue = candidateQueuesRef.current.get(senderUserId) || [];
        while (queue.length > 0) {
          const cand = queue.shift();
          await pc.addIceCandidate(cand);
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        if (currentRoomCodeRef.current) {
          sendSignaling('meeting-answer', {
            meetingCode: currentRoomCodeRef.current,
            targetUserId: senderUserId,
            sdp: answer
          });
        }
      } catch (err) {
        console.error('Failed to handle meeting-offer:', err);
      }
    });

    // Received answer from a peer
    const unsubAnswer = on('meeting-answer', async (payload) => {
      const { senderUserId, sdp } = payload;
      const pc = peersRef.current.get(senderUserId);
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));

          const queue = candidateQueuesRef.current.get(senderUserId) || [];
          while (queue.length > 0) {
            const cand = queue.shift();
            await pc.addIceCandidate(cand);
          }
        } catch (err) {
          console.error('Failed to set remote description from meeting-answer:', err);
        }
      }
    });

    // Received ICE candidate from a peer
    const unsubIce = on('meeting-ice-candidate', async (payload) => {
      const { senderUserId, candidate } = payload;
      if (!candidate) return;

      const iceCand = new RTCIceCandidate(candidate);
      const pc = peersRef.current.get(senderUserId);

      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(iceCand);
        } catch (e) {
          console.warn('Error adding meeting ICE candidate:', e);
        }
      } else {
        const queue = candidateQueuesRef.current.get(senderUserId) || [];
        queue.push(iceCand);
        candidateQueuesRef.current.set(senderUserId, queue);
      }
    });

    // Peer left the meeting
    const unsubUserLeft = on('meeting-user-left', (payload) => {
      const { userId } = payload;
      if (peersRef.current.has(userId)) {
        try { peersRef.current.get(userId).close(); } catch (e) {}
        peersRef.current.delete(userId);
      }
      candidateQueuesRef.current.delete(userId);
      analysersRef.current.delete(userId);

      setParticipants(prev => prev.filter(p => p.id !== userId));
      setParticipantStates(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      setRemoteStreams(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    });

    // Track states changed (mic, camera, screen share)
    const unsubTrackState = on('meeting-track-state-changed', (payload) => {
      const { userId, audioMuted, videoMuted, isScreenSharing: remoteScreenSharing } = payload;
      setParticipantStates(prev => ({
        ...prev,
        [userId]: {
          audioMuted: !!audioMuted,
          videoMuted: !!videoMuted,
          isScreenSharing: !!remoteScreenSharing
        }
      }));
    });

    // Recording status change
    const unsubRecordingState = on('meeting-recording-state', (payload) => {
      setIsRecording(payload.isRecording);
      setRecordingBy(payload.startedBy);
      soundService.playRecordingBeep();
    });

    // In-meeting chat message
    const unsubChat = on('meeting-chat-message', (payload) => {
      setInMeetingMessages(prev => [...prev, payload]);
      soundService.playMessageSound();
    });

    // Meeting ended for everyone by host
    const unsubMeetingEnded = on('meeting-ended-by-host', (payload) => {
      alert(`Meeting ended by host (${payload.endedBy || 'Host'})`);
      cleanupMeetingResources();
    });

    return () => {
      unsubJoined();
      unsubUserJoined();
      unsubOffer();
      unsubAnswer();
      unsubIce();
      unsubUserLeft();
      unsubTrackState();
      unsubRecordingState();
      unsubChat();
      unsubMeetingEnded();
    };
  }, [on, createPeerConnection, sendSignaling, cleanupMeetingResources]);

  return {
    inMeeting,
    meetingDetails,
    participants,
    localStream,
    screenStream,
    remoteStreams,
    isAudioMuted,
    isVideoMuted,
    isScreenSharing,
    participantStates,
    isRecording,
    recordingBy,
    activeSpeakerId,
    inMeetingMessages,
    joinMeeting,
    leaveMeeting,
    endMeetingForEveryone,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    broadcastRecordingState,
    sendMeetingChat
  };
}
