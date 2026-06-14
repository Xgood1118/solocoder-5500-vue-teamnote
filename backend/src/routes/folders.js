const { Router } = require('express');
const c = require('../controllers/folderController');
const { authenticate, requireWorkspacePermission, requireResourcePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../middleware/permissions');

const router = Router();
router.use(authenticate);

router.get('/ws/:workspaceId', requireWorkspacePermission(PERMISSIONS.FOLDER_VIEW), c.listByWorkspace);
router.get('/ws/:workspaceId/tree', requireWorkspacePermission(PERMISSIONS.FOLDER_VIEW), c.getTree);
router.post('/ws/:workspaceId', requireWorkspacePermission(PERMISSIONS.FOLDER_CREATE), c.create);
router.put('/:id', requireResourcePermission('folders', PERMISSIONS.FOLDER_EDIT, r => r.params.id), c.update);
router.delete('/:id', requireResourcePermission('folders', PERMISSIONS.FOLDER_DELETE, r => r.params.id), c.remove);
router.post('/move-note', c.moveNote);

module.exports = router;
