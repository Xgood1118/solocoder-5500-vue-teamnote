const { store } = require('../storage/jsonStore');
const { generateId, now } = require('../utils/common');

const ACTIONS = {
  LOGIN: 'user:login',
  LOGOUT: 'user:logout',
  WORKSPACE_CREATE: 'workspace:create',
  WORKSPACE_UPDATE: 'workspace:update',
  WORKSPACE_DELETE: 'workspace:delete',
  WORKSPACE_MEMBER_ADD: 'workspace:member_add',
  WORKSPACE_MEMBER_REMOVE: 'workspace:member_remove',
  WORKSPACE_MEMBER_ROLE_CHANGE: 'workspace:member_role_change',
  FOLDER_CREATE: 'folder:create',
  FOLDER_UPDATE: 'folder:update',
  FOLDER_DELETE: 'folder:delete',
  FOLDER_MOVE: 'folder:move',
  NOTE_CREATE: 'note:create',
  NOTE_UPDATE: 'note:update',
  NOTE_DELETE: 'note:delete',
  NOTE_MOVE: 'note:move',
  NOTE_ROLLBACK: 'note:rollback',
  NOTE_EXPORT: 'note:export',
  NOTE_IMPORT: 'note:import',
  COMMENT_CREATE: 'comment:create',
  COMMENT_RESOLVE: 'comment:resolve',
  COMMENT_REOPEN: 'comment:reopen',
  COMMENT_DELETE: 'comment:delete',
  INVITE_CREATE: 'invite:create',
  INVITE_ACCEPT: 'invite:accept',
  INVITE_REVOKE: 'invite:revoke',
  TAG_CREATE: 'tag:create',
  TAG_DELETE: 'tag:delete',
  TEMPLATE_CREATE: 'template:create',
  TEMPLATE_DELETE: 'template:delete',
  PERMISSION_CHANGE: 'permission:change',
};

class AuditService {
  log({ action, userId, workspaceId, resourceId = null, resourceType = null, details = {}, ip = null }) {
    const id = generateId('audit_');
    const record = { id, action, userId, workspaceId, resourceId, resourceType, details, ip, createdAt: now() };
    store.insert('auditLogs', id, record);
    return record;
  }

  query({ workspaceId, userId, action, resourceId, fromDate, toDate, limit = 100, offset = 0 } = {}) {
    let list = store.findAll('auditLogs');
    if (workspaceId) list = list.filter(l => l.workspaceId === workspaceId);
    if (userId) list = list.filter(l => l.userId === userId);
    if (action) list = list.filter(l => l.action === action);
    if (resourceId) list = list.filter(l => l.resourceId === resourceId);
    if (fromDate) list = list.filter(l => l.createdAt >= fromDate);
    if (toDate) list = list.filter(l => l.createdAt <= toDate);
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const total = list.length;
    const items = list.slice(offset, offset + limit);
    const userIds = [...new Set(items.map(i => i.userId))];
    const users = Object.fromEntries(
      store.findAll('users', u => userIds.includes(u.id)).map(u => [u.id, { id: u.id, name: u.name, username: u.username }])
    );
    return { total, items, users };
  }
}

const auditService = new AuditService();

module.exports = { auditService, ACTIONS };
