const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const { setupSignalingServer } = require('./signalingServer');

// Initialize database
require('./database');

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static route for avatars and preview files
app.use('/storage/avatars', express.static(config.AVATARS_DIR));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/calls', require('./routes/calls'));
app.use('/api/meetings', require('./routes/meetings'));
app.use('/api/files', require('./routes/files'));
app.use('/api/recordings', require('./routes/recordings'));
app.use('/api/config', require('./routes/config'));

// Root healthcheck
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    webrtc: 'native',
    uptime: process.uptime()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Create HTTP server
const server = http.createServer(app);

// Attach WebSocket Signaling Server
setupSignalingServer(server);

// Start listening only when executed directly
if (require.main === module) {
  server.listen(config.PORT, () => {
    console.log(`=======================================================`);
    console.log(` WebRTC Standalone Communication Server Running!`);
    console.log(` REST API: http://localhost:${config.PORT}/api`);
    console.log(` WebSocket Signaling: ws://localhost:${config.PORT}/ws`);
    console.log(` Storage Path: ${config.STORAGE_DIR}`);
    console.log(` SQLite Database: ${config.DATABASE_PATH}`);
    console.log(`=======================================================`);

    // Keep-alive self-ping for Render free tier (prevents idle sleeping)
    const renderExternalUrl = process.env.RENDER_EXTERNAL_URL;
    if (renderExternalUrl) {
      console.log(`[Keep-Alive] Render detected at ${renderExternalUrl}. Starting self-ping heartbeat...`);
      const https = require('https');
      const pingUrl = `${renderExternalUrl.replace(/\/$/, '')}/api/health`;

      // Ping every 10 minutes (Render sleep threshold is 15 minutes)
      setInterval(() => {
        https.get(pingUrl, (res) => {
          if (res.statusCode === 200) {
            console.log(`[Keep-Alive] Heartbeat ping successful at ${new Date().toISOString()}`);
          }
        }).on('error', (err) => {
          console.warn(`[Keep-Alive] Ping error: ${err.message}`);
        });
      }, 10 * 60 * 1000);
    }
  });
}

module.exports = { app, server };
