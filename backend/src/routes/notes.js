const { Router } = require('express');
const c = require('../controllers/noteController');
const { authenticate, requireWorkspacePermission, requireResourcePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../middleware/permissions');

const router = Router();
router.use(authenticate);

router.get('/ws/:workspaceId', requireWorkspacePermission(PERMISSIONS.NOTE_VIEW), c.listByWorkspace);
router.get('/ws/:workspaceId/recent', requireWorkspacePermission(PERMISSIONS.NOTE_VIEW), c.recent);
router.get('/folder/:folderId', c.listByFolder);
router.get('/:id', requireResourcePermission('notes', PERMISSIONS.NOTE_VIEW, r => r.params.id), c.get);
router.post('/', c.create);
router.put('/:id', requireResourcePermission('notes', PERMISSIONS.NOTE_EDIT, r => r.params.id), c.update);
router.delete('/:id', requireResourcePermission('notes', PERMISSIONS.NOTE_DELETE, r => r.params.id), c.remove);
router.post('/:id/versions', requireResourcePermission('notes', PERMISSIONS.NOTE_EDIT, r => r.params.id), c.saveVersion);
router.get('/:id/versions', requireResourcePermission('notes', PERMISSIONS.HISTORY_VIEW, r => r.params.id), c.listVersions);
router.post('/:id/rollback', requireResourcePermission('notes', PERMISSIONS.VERSION_ROLLBACK, r => r.params.id), c.rollback);
router.post('/:id/share', requireResourcePermission('notes', PERMISSIONS.NOTE_EDIT, r => r.params.id), c.share);

module.exports = router;
