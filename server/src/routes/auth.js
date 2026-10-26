const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const config = require('../config');
const { authenticateToken } = require('../middleware/auth');

// Register
router.post('/register', (req, res) => {
  try {
    const { email, password, displayName, title, avatar } = req.body;
    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'Email, password, and display name are required' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email.trim());
    if (existing) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);
    const userId = 'usr_' + uuidv4().substring(0, 10);
    const userAvatar = avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`;

    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, avatar, title, status)
      VALUES (?, ?, ?, ?, ?, ?, 'online')
    `).run(userId, email.trim().toLowerCase(), passwordHash, displayName.trim(), userAvatar, title || 'Team Member');

    const token = jwt.sign({ userId, email: email.trim().toLowerCase() }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN });

    const user = db.prepare('SELECT id, email, display_name as displayName, avatar, title, status, status_message as statusMessage FROM users WHERE id = ?').get(userId);

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error during registration' });
  }
});

// Login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email.trim());
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Set status to online on login
    db.prepare("UPDATE users SET status = 'online', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(user.id);

    const token = jwt.sign({ userId: user.id, email: user.email }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN });

    const userProfile = {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      avatar: user.avatar,
      title: user.title,
      status: 'online',
      statusMessage: user.status_message
    };

    res.json({ token, user: userProfile });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// Get current user
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// Update profile / status
router.put('/profile', authenticateToken, (req, res) => {
  try {
    const { displayName, title, status, statusMessage, avatar } = req.body;
    const updates = [];
    const values = [];

    if (displayName) { updates.push('display_name = ?'); values.push(displayName); }
    if (title) { updates.push('title = ?'); values.push(title); }
    if (status) { updates.push('status = ?'); values.push(status); }
    if (statusMessage !== undefined) { updates.push('status_message = ?'); values.push(statusMessage); }
    if (avatar) { updates.push('avatar = ?'); values.push(avatar); }

    if (updates.length === 0) {
      return res.json({ user: req.user });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.user.id);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updatedUser = db.prepare('SELECT id, email, display_name as displayName, avatar, title, status, status_message as statusMessage FROM users WHERE id = ?').get(req.user.id);
    res.json({ user: updatedUser });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Quick demo users for effortless testing
router.get('/demo-users', (req, res) => {
  try {
    const demo = db.prepare('SELECT id, email, display_name as displayName, avatar, title, status FROM users LIMIT 6').all();
    res.json({ users: demo });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch demo users' });
  }
});

module.exports = router;
