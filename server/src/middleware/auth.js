const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../database');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, config.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired access token' });
    }

    const user = db.prepare('SELECT id, email, display_name as displayName, avatar, title, status, status_message as statusMessage FROM users WHERE id = ?').get(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  });
}

module.exports = { authenticateToken };
