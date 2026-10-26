const express = require('express');
const router = express.Router();
const config = require('../config');

// Public ICE server configuration for WebRTC RTCPeerConnection
router.get('/ice-servers', (req, res) => {
  res.json({
    iceServers: config.ICE_SERVERS,
    maxMeetingParticipants: config.MAX_MEETING_PARTICIPANTS
  });
});

// System info
router.get('/info', (req, res) => {
  res.json({
    name: 'Connect Standalone WebRTC',
    version: '1.0.0',
    meshLimit: config.MAX_MEETING_PARTICIPANTS,
    audioSupported: true,
    videoSupported: true,
    screenShareSupported: true,
    recordingSupported: true
  });
});

module.exports = router;
