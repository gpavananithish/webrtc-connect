const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

// Storage for general chat attachments
const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = uuidv4() + ext;
    cb(null, safeName);
  }
});

// Storage for meeting recordings
const recordingStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.RECORDINGS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `rec_${uuidv4()}${ext}`);
  }
});

const uploadFile = multer({
  storage: fileStorage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

const uploadRecording = multer({
  storage: recordingStorage,
  limits: { fileSize: 250 * 1024 * 1024 } // 250MB
});

module.exports = {
  uploadFile,
  uploadRecording
};
