const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const config = require('../config');
const { authenticateToken } = require('../middleware/auth');

// Generate human-friendly 9-character code (e.g., abc-defg-hij)
function generateMeetingCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const pick = (len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${pick(3)}-${pick(4)}-${pick(3)}`;
}

// Create meeting room
router.post('/create', authenticateToken, (req, res) => {
  try {
    const { title, password, maxParticipants } = req.body;
    const userId = req.user.id;

    const meetingId = 'mtg_' + uuidv4().substring(0, 10);
    const code = generateMeetingCode();
    const capacity = Math.min(parseInt(maxParticipants, 10) || config.MAX_MEETING_PARTICIPANTS, 12);

    db.prepare(`
      INSERT INTO meetings (id, code, title, host_id, password, max_participants, is_active, started_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    `).run(
      meetingId,
      code,
      (title && title.trim()) || `${req.user.displayName}'s Meeting`,
      userId,
      password ? password.trim() : null,
      capacity
    );

    const meeting = db.prepare(`
      SELECT m.id, m.code, m.title, m.host_id as hostId, m.max_participants as maxParticipants,
             m.is_active as isActive, m.started_at as startedAt,
             u.display_name as hostName, u.avatar as hostAvatar,
             CASE WHEN m.password IS NOT NULL THEN 1 ELSE 0 END as hasPassword
      FROM meetings m
      JOIN users u ON m.host_id = u.id
      WHERE m.id = ?
    `).get(meetingId);

    res.status(201).json({ meeting });
  } catch (err) {
    console.error('Create meeting error:', err);
    res.status(500).json({ error: 'Failed to create meeting room' });
  }
});

// Validate meeting access before joining
router.post('/validate', authenticateToken, (req, res) => {
  try {
    const { code, password } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Meeting code is required' });
    }

    const meeting = db.prepare(`
      SELECT m.id, m.code, m.title, m.host_id as hostId, m.password,
             m.max_participants as maxParticipants, m.is_active as isActive,
             m.started_at as startedAt, u.display_name as hostName, u.avatar as hostAvatar
      FROM meetings m
      JOIN users u ON m.host_id = u.id
      WHERE m.code = ?
    `).get(code.trim().toLowerCase());

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting room not found' });
    }

    if (!meeting.isActive) {
      return res.status(410).json({ error: 'This meeting has already ended' });
    }

    // Check password if set and user is not host
    if (meeting.password && meeting.hostId !== req.user.id) {
      if (!password || password.trim() !== meeting.password) {
        return res.status(401).json({ 
          error: 'Meeting requires a valid password',
          requiresPassword: true 
        });
      }
    }

    res.json({
      meeting: {
        id: meeting.id,
        code: meeting.code,
        title: meeting.title,
        hostId: meeting.hostId,
        hostName: meeting.hostName,
        hostAvatar: meeting.hostAvatar,
        maxParticipants: meeting.maxParticipants,
        startedAt: meeting.startedAt,
        hasPassword: !!meeting.password
      }
    });
  } catch (err) {
    console.error('Validate meeting error:', err);
    res.status(500).json({ error: 'Failed to validate meeting' });
  }
});

// Get user meeting history
router.get('/history', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;

    const meetings = db.prepare(`
      SELECT m.id, m.code, m.title, m.host_id as hostId, m.is_active as isActive,
             m.started_at as startedAt, m.ended_at as endedAt,
             u.display_name as hostName, u.avatar as hostAvatar,
             (SELECT COUNT(*) FROM recordings r WHERE r.meeting_id = m.id) as recordingCount
      FROM meetings m
      JOIN users u ON m.host_id = u.id
      WHERE m.host_id = ? OR m.id IN (SELECT meeting_id FROM meeting_participants WHERE user_id = ?)
      ORDER BY m.started_at DESC
      LIMIT 30
    `).all(userId, userId);

    res.json({ meetings });
  } catch (err) {
    console.error('Meeting history error:', err);
    res.status(500).json({ error: 'Failed to retrieve meeting history' });
  }
});

// End meeting (host only)
router.post('/:id/end', authenticateToken, (req, res) => {
  try {
    const meetingId = req.params.id;
    const meeting = db.prepare('SELECT host_id FROM meetings WHERE id = ?').get(meetingId);

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    if (meeting.host_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the meeting host can end the meeting' });
    }

    db.prepare(`
      UPDATE meetings SET is_active = 0, ended_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(meetingId);

    res.json({ success: true, message: 'Meeting concluded' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to end meeting' });
  }
});

module.exports = router;
