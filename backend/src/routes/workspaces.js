const { Router } = require('express');
const c = require('../controllers/workspaceController');
const { authenticate, requireWorkspacePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../middleware/permissions');

const router = Router();
router.use(authenticate);

router.get('/', c.listMyWorkspaces);
router.post('/', c.createWorkspace);
router.get('/:workspaceId', requireWorkspacePermission(PERMISSIONS.FOLDER_VIEW), c.getWorkspace);
router.put('/:workspaceId', requireWorkspacePermission(PERMISSIONS.WORKSPACE_MANAGE_SETTINGS), c.updateWorkspace);
router.delete('/:workspaceId', requireWorkspacePermission(PERMISSIONS.WORKSPACE_DELETE), c.deleteWorkspace);
router.post('/:workspaceId/members', requireWorkspacePermission(PERMISSIONS.WORKSPACE_MANAGE_MEMBERS), c.updateMemberRole);
router.delete('/:workspaceId/members', requireWorkspacePermission(PERMISSIONS.WORKSPACE_MANAGE_MEMBERS), c.removeMember);
router.post('/:workspaceId/transfer', requireWorkspacePermission(PERMISSIONS.WORKSPACE_DELETE), c.transferOwnership);
router.post('/:workspaceId/invites', requireWorkspacePermission(PERMISSIONS.INVITE_CREATE), c.createInviteLink);
router.get('/:workspaceId/invites', requireWorkspacePermission(PERMISSIONS.WORKSPACE_MANAGE_MEMBERS), c.listInviteLinks);
router.delete('/:workspaceId/invites/:id', requireWorkspacePermission(PERMISSIONS.WORKSPACE_MANAGE_MEMBERS), c.revokeInviteLink);
router.get('/:workspaceId/audit-logs', requireWorkspacePermission(PERMISSIONS.AUDIT_VIEW), c.getAuditLogs);

module.exports = router;
