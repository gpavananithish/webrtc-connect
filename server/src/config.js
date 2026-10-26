const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from server root or parent
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const STORAGE_DIR = process.env.STORAGE_DIR 
  ? path.resolve(__dirname, '..', process.env.STORAGE_DIR)
  : path.resolve(__dirname, '../../storage');

const DATABASE_PATH = process.env.DATABASE_PATH
  ? path.resolve(__dirname, '..', process.env.DATABASE_PATH)
  : path.join(STORAGE_DIR, 'database.sqlite');

module.exports = {
  PORT: parseInt(process.env.PORT, 10) || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || 'fallback-dev-jwt-secret-connect-webrtc-2026',
  JWT_EXPIRES_IN: '7d',
  STORAGE_DIR,
  UPLOADS_DIR: path.join(STORAGE_DIR, 'uploads'),
  RECORDINGS_DIR: path.join(STORAGE_DIR, 'recordings'),
  AVATARS_DIR: path.join(STORAGE_DIR, 'avatars'),
  DATABASE_PATH,
  MAX_MEETING_PARTICIPANTS: parseInt(process.env.MAX_MEETING_PARTICIPANTS, 10) || 6,
  ICE_SERVERS: [
    {
      urls: [process.env.STUN_SERVER || 'stun:stun.l.google.com:19302']
    },
    ...(process.env.TURN_SERVER ? [{
      urls: [process.env.TURN_SERVER],
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL
    }] : [])
  ]
};
