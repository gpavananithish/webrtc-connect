const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const config = require('../config');
const { authenticateToken } = require('../middleware/auth');
const { uploadFile } = require('../middleware/upload');

// Helper to determine file category
function getFileCategory(mimetype, ext) {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype === 'application/pdf') return 'pdf';
  if (['.doc', '.docx'].includes(ext)) return 'word';
  if (['.xls', '.xlsx', '.csv'].includes(ext)) return 'excel';
  if (['.zip', '.rar', '.tar', '.gz'].includes(ext)) return 'archive';
  return 'file';
}

// Upload file attachment
router.post('/upload', authenticateToken, uploadFile.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { conversationId } = req.body;
    const userId = req.user.id;

    // Check membership if conversationId provided
    if (conversationId) {
      const isMember = db.prepare('SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?').get(conversationId, userId);
      if (!isMember) {
        fs.unlinkSync(req.file.path);
        return res.status(403).json({ error: 'Not authorized for this conversation' });
      }
    }

    const fileId = 'file_' + uuidv4().substring(0, 10);
    const ext = path.extname(req.file.originalname).toLowerCase();
    const category = getFileCategory(req.file.mimetype, ext);

    db.prepare(`
      INSERT INTO files (id, original_name, filename, mimetype, size, sender_id, conversation_id, file_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      fileId,
      path.basename(req.file.originalname),
      req.file.filename,
      req.file.mimetype,
      req.file.size,
      userId,
      conversationId || null,
      category
    );

    res.status(201).json({
      file: {
        id: fileId,
        originalName: req.file.originalname,
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size,
        category,
        url: `/api/files/${fileId}/download`
      }
    });
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Upload voice message
router.post('/voice', authenticateToken, uploadFile.single('audio'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio recorded' });
    }

    const { conversationId, duration } = req.body;
    const userId = req.user.id;

    const fileId = 'voice_' + uuidv4().substring(0, 10);
    const durationSeconds = parseFloat(duration) || 0;

    db.prepare(`
      INSERT INTO files (id, original_name, filename, mimetype, size, sender_id, conversation_id, file_type, duration_seconds)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'voice', ?)
    `).run(
      fileId,
      'Voice message.webm',
      req.file.filename,
      req.file.mimetype || 'audio/webm',
      req.file.size,
      userId,
      conversationId || null,
      durationSeconds
    );

    res.status(201).json({
      file: {
        id: fileId,
        originalName: 'Voice message',
        filename: req.file.filename,
        mimetype: req.file.mimetype || 'audio/webm',
        size: req.file.size,
        category: 'voice',
        duration: durationSeconds,
        url: `/api/files/${fileId}/download`
      }
    });
  } catch (err) {
    console.error('Voice message upload error:', err);
    res.status(500).json({ error: 'Failed to upload voice message' });
  }
});

// Download / stream file
router.get('/:id/download', (req, res) => {
  try {
    const fileId = req.params.id;
    const fileRecord = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId);

    if (!fileRecord) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = path.join(config.UPLOADS_DIR, fileRecord.filename);

    // Guard against path traversal
    if (!filePath.startsWith(config.UPLOADS_DIR) || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File storage path invalid or missing' });
    }

    res.setHeader('Content-Type', fileRecord.mimetype || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileRecord.original_name)}"`);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err) {
    console.error('File download error:', err);
    res.status(500).json({ error: 'Failed to fetch file' });
  }
});

module.exports = router;
