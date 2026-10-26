const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const config = require('../config');
const { authenticateToken } = require('../middleware/auth');
const { uploadRecording } = require('../middleware/upload');

// Upload completed meeting recording
router.post('/upload', authenticateToken, uploadRecording.single('recording'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No recording file uploaded' });
    }

    const { meetingId, meetingTitle, duration } = req.body;
    const userId = req.user.id;
    const recordingId = 'rec_' + uuidv4().substring(0, 10);
    const durationSeconds = Math.round(parseFloat(duration) || 0);

    db.prepare(`
      INSERT INTO recordings (id, meeting_id, meeting_title, user_id, filename, filesize, duration_seconds, mimetype)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      recordingId,
      meetingId || null,
      meetingTitle || 'Meeting Session Recording',
      userId,
      req.file.filename,
      req.file.size,
      durationSeconds,
      req.file.mimetype || 'video/webm'
    );

    res.status(201).json({
      recording: {
        id: recordingId,
        meetingId,
        meetingTitle: meetingTitle || 'Meeting Session Recording',
        filename: req.file.filename,
        filesize: req.file.size,
        durationSeconds,
        url: `/api/recordings/${recordingId}/stream`
      }
    });
  } catch (err) {
    console.error('Upload recording error:', err);
    res.status(500).json({ error: 'Failed to save recording' });
  }
});

// List recordings for current user
router.get('/', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;

    const recordings = db.prepare(`
      SELECT 
        r.id, r.meeting_id as meetingId, r.meeting_title as meetingTitle,
        r.filename, r.filesize, r.duration_seconds as durationSeconds,
        r.mimetype, r.created_at as createdAt,
        u.display_name as recordedByName, u.avatar as recordedByAvatar,
        m.code as meetingCode
      FROM recordings r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN meetings m ON r.meeting_id = m.id
      ORDER BY r.created_at DESC
      LIMIT 50
    `).all();

    const formatted = recordings.map(r => ({
      id: r.id,
      meetingId: r.meetingId,
      meetingCode: r.meetingCode,
      meetingTitle: r.meetingTitle,
      filesize: r.filesize,
      durationSeconds: r.durationSeconds,
      createdAt: r.createdAt,
      recordedBy: {
        name: r.recordedByName,
        avatar: r.recordedByAvatar
      },
      url: `/api/recordings/${r.id}/stream`
    }));

    res.json({ recordings: formatted });
  } catch (err) {
    console.error('List recordings error:', err);
    res.status(500).json({ error: 'Failed to retrieve recordings' });
  }
});

// Stream or download recording
router.get('/:id/stream', (req, res) => {
  try {
    const recordingId = req.params.id;
    const rec = db.prepare('SELECT * FROM recordings WHERE id = ?').get(recordingId);

    if (!rec) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    const filePath = path.join(config.RECORDINGS_DIR, rec.filename);

    if (!filePath.startsWith(config.RECORDINGS_DIR) || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Recording file missing or inaccessible' });
    }

    const stat = fs.statSync(filePath);
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': rec.mimetype || 'video/webm'
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': stat.size,
        'Content-Type': rec.mimetype || 'video/webm'
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    console.error('Stream recording error:', err);
    res.status(500).json({ error: 'Failed to stream recording' });
  }
});

// Delete recording
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const recordingId = req.params.id;
    const rec = db.prepare('SELECT user_id, filename FROM recordings WHERE id = ?').get(recordingId);

    if (!rec) {
      return res.status(404).json({ error: 'Recording not found' });
    }
    if (rec.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the recording owner can delete it' });
    }

    const filePath = path.join(config.RECORDINGS_DIR, rec.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    db.prepare('DELETE FROM recordings WHERE id = ?').run(recordingId);
    res.json({ success: true, message: 'Recording deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete recording' });
  }
});

module.exports = router;
