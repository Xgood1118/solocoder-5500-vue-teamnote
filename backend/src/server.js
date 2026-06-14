const express = require('express');
const cors = require('cors');
const http = require('http');
const config = require('./config');
const { seedIfEmpty } = require('./storage/seed');
const { backupManager } = require('./storage/backup');
const { collabServer } = require('./services/collaboration');
const { AppError, sendError } = require('./utils/common');
const { notificationService } = require('./services/notification');

const authRoutes = require('./routes/auth');
const workspaceRoutes = require('./routes/workspaces');
const folderRoutes = require('./routes/folders');
const noteRoutes = require('./routes/notes');
const commentRoutes = require('./routes/comments');
const miscRoutes = require('./routes/misc');
const ioRoutes = require('./routes/io');

function createApp() {
  const app = express();
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), env: config.nodeEnv });
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), env: config.nodeEnv, time: new Date().toISOString() });
  });

  app.get('/api/events/sse', (req, res) => {
    const token = req.query.token;
    if (!token) return res.status(401).end();
    const { verifyToken } = require('./utils/auth');
    const payload = verifyToken(token);
    if (!payload) return res.status(401).end();
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.write(`retry: 3000\n\ndata: ${JSON.stringify({ type: 'connected', userId: payload.userId })}\n\n`);
    const handler = (userId, notif) => {
      if (userId === payload.userId) {
        res.write(`data: ${JSON.stringify({ type: 'notification', data: notif })}\n\n`);
      }
    };
    notificationService.on('notify', handler);
    const ping = setInterval(() => {
      try { res.write(`: ping ${Date.now()}\n\n`); } catch (e) {}
    }, 30000);
    req.on('close', () => {
      notificationService.off('notify', handler);
      clearInterval(ping);
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/workspaces', workspaceRoutes);
  app.use('/api/folders', folderRoutes);
  app.use('/api/notes', noteRoutes);
  app.use('/api/comments', commentRoutes);
  app.use('/api', miscRoutes);
  app.use('/api/io', ioRoutes);

  app.get('/api', (req, res) => {
    res.json({
      name: 'TeamNote Backend API',
      version: '1.0.0',
      endpoints: [
        '/api/auth', '/api/workspaces', '/api/folders', '/api/notes',
        '/api/comments', '/api/search', '/api/tags', '/api/templates',
        '/api/notifications', '/api/io', '/api/events/sse', '/ws/collab',
      ],
    });
  });

  app.use((err, req, res, next) => {
    console.error('[Error]', err);
    if (res.headersSent) return next(err);
    sendError(res, err.statusCode ? err : new AppError(err.message || 'Internal Server Error', 500, err.code || 'INTERNAL'));
  });

  return app;
}

function startServer() {
  seedIfEmpty();
  backupManager.startScheduler();
  setTimeout(() => backupManager.createBackup().catch(e => console.warn('Initial backup skipped:', e.message)), 5000);

  const app = createApp();
  const server = http.createServer(app);
  collabServer.start(server);

  server.listen(config.port, () => {
    console.log(`
╔══════════════════════════════════════════════════════╗
║  TeamNote Backend                                     ║
║  HTTP:        http://localhost:${config.port}                     ║
║  WS path:     /ws/collab (same HTTP server)           ║
║  SSE events:  /api/events/sse                         ║
║  Environment: ${config.nodeEnv.padEnd(32)} ║
║  Data dir:    ${config.dataDir.slice(0, 42).padEnd(42)} ║
╚══════════════════════════════════════════════════════╝
    `);
    console.log('[Seed] 默认账号: owner / admin / editor / viewer / guest  (密码: 123456)');
  });

  process.on('SIGTERM', () => {
    console.log('SIGTERM received, creating backup...');
    try { backupManager.createBackup(); } catch (e) {}
    process.exit(0);
  });

  return server;
}

module.exports = { createApp, startServer };
