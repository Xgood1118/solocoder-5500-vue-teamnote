require('dotenv').config();
const path = require('path');

module.exports = {
  port: parseInt(process.env.PORT || '3001', 10),
  wsPort: parseInt(process.env.WS_PORT || '3002', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production-please',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dataDir: path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data')),
  backupDir: path.resolve(process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups')),
  uploadDir: path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads')),
  backupIntervalMinutes: parseInt(process.env.BACKUP_INTERVAL_MINUTES || '60', 10),
  maxBackups: parseInt(process.env.MAX_BACKUPS || '10', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',
};
