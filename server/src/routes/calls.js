const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

// Get call history for current user
router.get('/history', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;

    const calls = db.prepare(`
      SELECT 
        c.id, c.caller_id as callerId, c.callee_id as calleeId,
        c.call_type as callType, c.status, c.started_at as startedAt,
        c.ended_at as endedAt, c.duration_seconds as durationSeconds,
        caller.display_name as callerName, caller.avatar as callerAvatar,
        callee.display_name as calleeName, callee.avatar as calleeAvatar
      FROM calls c
      JOIN users caller ON c.caller_id = caller.id
      JOIN users callee ON c.callee_id = callee.id
      WHERE c.caller_id = ? OR c.callee_id = ?
      ORDER BY c.started_at DESC
      LIMIT 50
    `).all(userId, userId);

    const formatted = calls.map(c => {
      const isOutgoing = c.callerId === userId;
      const otherUser = isOutgoing ? {
        id: c.calleeId,
        displayName: c.calleeName,
        avatar: c.calleeAvatar
      } : {
        id: c.callerId,
        displayName: c.callerName,
        avatar: c.callerAvatar
      };

      return {
        id: c.id,
        direction: isOutgoing ? 'outgoing' : 'incoming',
        isMissed: !isOutgoing && (c.status === 'missed' || c.status === 'rejected'),
        callType: c.callType,
        status: c.status,
        startedAt: c.startedAt,
        endedAt: c.endedAt,
        durationSeconds: c.durationSeconds,
        otherUser
      };
    });

    res.json({ calls: formatted });
  } catch (err) {
    console.error('Call history error:', err);
    res.status(500).json({ error: 'Failed to retrieve call history' });
  }
});

// Log a call record
router.post('/log', authenticateToken, (req, res) => {
  try {
    const { calleeId, callType, status, durationSeconds = 0, startedAt, endedAt } = req.body;
    const callerId = req.user.id;

    if (!calleeId || !callType || !status) {
      return res.status(400).json({ error: 'calleeId, callType, and status are required' });
    }

    const callId = 'call_' + uuidv4().substring(0, 10);

    db.prepare(`
      INSERT INTO calls (id, caller_id, callee_id, call_type, status, started_at, ended_at, duration_seconds)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      callId,
      callerId,
      calleeId,
      callType,
      status,
      startedAt || new Date().toISOString(),
      endedAt || new Date().toISOString(),
      durationSeconds
    );

    res.status(201).json({ success: true, callId });
  } catch (err) {
    console.error('Log call error:', err);
    res.status(500).json({ error: 'Failed to log call' });
  }
});

module.exports = router;
