const { Router } = require('express');
const c = require('../controllers/miscController');
const { notificationService } = require('../services/notification');
const { authenticate } = require('../middleware/auth');

const router = Router();
router.use(authenticate);

router.get('/search', c.searchNotes);
router.get('/search/history/:workspaceId', c.history);
router.delete('/search/history/:workspaceId', c.clearHistory);
router.get('/search/hot/:workspaceId', c.hotTerms);

router.get('/tags/:workspaceId', c.listTags);
router.post('/tags', c.createTag);
router.delete('/tags/:id', c.deleteTag);

router.get('/templates', c.listTemplates);
router.post('/templates', c.createTemplate);
router.put('/templates/:id', c.updateTemplate);
router.delete('/templates/:id', c.deleteTemplate);

router.get('/notifications', c.listNotifications);
router.post('/notifications/:id/read', c.markNotificationRead);
router.post('/notifications/read-all', c.markAllNotificationsRead);

router.get('/users', c.listUsers);

module.exports = router;
