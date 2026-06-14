const { Router } = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const config = require('../config');
const c = require('../controllers/ioController');
const { authenticate, requireResourcePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../middleware/permissions');

const router = Router();
router.use(authenticate);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(config.uploadDir)) fs.mkdirSync(config.uploadDir, { recursive: true });
    cb(null, config.uploadDir);
  },
  filename: (req, file, cb) => {
    const safe = (file.originalname || 'f').replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, Date.now() + '-' + safe);
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

router.get('/notes/:id/export/md', c.exportMarkdown);
router.get('/notes/:id/export/html', c.exportHtml);
router.get('/notes/:id/export/pdf', c.exportPdf);
router.post('/import/md', c.importMarkdown);
router.post('/import/file', upload.single('file'), c.importFile);

module.exports = router;
