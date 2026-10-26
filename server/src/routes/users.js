const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

// Get all users / directory (with optional search query)
router.get('/', authenticateToken, (req, res) => {
  try {
    const q = req.query.q ? `%${req.query.q.trim()}%` : null;
    let query = `
      SELECT id, email, display_name as displayName, avatar, title, status, status_message as statusMessage, created_at as createdAt
      FROM users
      WHERE id != ?
    `;
    const params = [req.user.id];

    if (q) {
      query += ` AND (display_name LIKE ? OR email LIKE ? OR title LIKE ?)`;
      params.push(q, q, q);
    }

    query += ` ORDER BY status = 'online' DESC, display_name ASC`;

    const users = db.prepare(query).all(...params);
    res.json({ users });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Failed to retrieve directory' });
  }
});

// Get user by ID
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const user = db.prepare(`
      SELECT id, email, display_name as displayName, avatar, title, status, status_message as statusMessage, created_at as createdAt
      FROM users
      WHERE id = ?
    `).get(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
