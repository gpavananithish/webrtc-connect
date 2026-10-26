const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');

// Ensure storage directories exist
if (!fs.existsSync(config.STORAGE_DIR)) {
  fs.mkdirSync(config.STORAGE_DIR, { recursive: true });
}
if (!fs.existsSync(config.UPLOADS_DIR)) {
  fs.mkdirSync(config.UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(config.RECORDINGS_DIR)) {
  fs.mkdirSync(config.RECORDINGS_DIR, { recursive: true });
}
if (!fs.existsSync(config.AVATARS_DIR)) {
  fs.mkdirSync(config.AVATARS_DIR, { recursive: true });
}

const db = new Database(config.DATABASE_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      avatar TEXT,
      title TEXT DEFAULT 'Team Member',
      status TEXT DEFAULT 'offline',
      status_message TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      is_group INTEGER DEFAULT 0,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS conversation_participants (
      conversation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (conversation_id, user_id),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      original_name TEXT NOT NULL,
      filename TEXT NOT NULL,
      mimetype TEXT NOT NULL,
      size INTEGER NOT NULL,
      sender_id TEXT NOT NULL,
      conversation_id TEXT,
      file_type TEXT DEFAULT 'file',
      duration_seconds REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      message_type TEXT DEFAULT 'text',
      content TEXT,
      file_id TEXT,
      reply_to_id TEXT,
      status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'read'
      is_edited INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL,
      FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS calls (
      id TEXT PRIMARY KEY,
      caller_id TEXT NOT NULL,
      callee_id TEXT NOT NULL,
      call_type TEXT NOT NULL, -- 'audio' or 'video'
      status TEXT NOT NULL, -- 'completed', 'missed', 'rejected', 'busy', 'failed'
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      duration_seconds INTEGER DEFAULT 0,
      FOREIGN KEY (caller_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (callee_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      host_id TEXT NOT NULL,
      password TEXT,
      max_participants INTEGER DEFAULT 6,
      is_active INTEGER DEFAULT 1,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS meeting_participants (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      left_at DATETIME,
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS recordings (
      id TEXT PRIMARY KEY,
      meeting_id TEXT,
      meeting_title TEXT,
      user_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      filesize INTEGER NOT NULL,
      duration_seconds INTEGER DEFAULT 0,
      mimetype TEXT DEFAULT 'video/webm',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_calls_caller ON calls(caller_id);
    CREATE INDEX IF NOT EXISTS idx_calls_callee ON calls(callee_id);
    CREATE INDEX IF NOT EXISTS idx_meetings_code ON meetings(code);
  `);

  try {
    db.prepare("ALTER TABLE messages ADD COLUMN status TEXT DEFAULT 'sent'").run();
  } catch (e) {
    // Column already exists
  }

  seedInitialData();
}

function seedInitialData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) return;

  console.log('Seeding initial demo team users...');
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('password123', salt);

  const demoUsers = [
    {
      id: 'usr_nithish_' + uuidv4().substring(0, 8),
      email: 'nithish@connect.local',
      displayName: 'Nithish',
      title: 'Developer',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      status: 'offline'
    },
    {
      id: 'usr_surya_' + uuidv4().substring(0, 8),
      email: 'surya@connect.local',
      displayName: 'Surya',
      title: 'Developer',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      status: 'offline'
    },
    {
      id: 'usr_ajay_' + uuidv4().substring(0, 8),
      email: 'ajay@connect.local',
      displayName: 'Ajay',
      title: 'Developer',
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
      status: 'offline'
    },
    {
      id: 'usr_vamsi_' + uuidv4().substring(0, 8),
      email: 'vamsi@connect.local',
      displayName: 'Vamsi',
      title: 'Developer',
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
      status: 'offline'
    }
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (id, email, password_hash, display_name, avatar, title, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const u of demoUsers) {
    insertUser.run(u.id, u.email, passwordHash, u.displayName, u.avatar, u.title, u.status);
  }

  console.log('Database initialized with clean chat history and Indian demo accounts.');
}

initializeDatabase();

module.exports = db;
