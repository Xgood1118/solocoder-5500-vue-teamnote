const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  EDITOR: 'editor',
  VIEWER: 'viewer',
  GUEST: 'guest',
};

const PERMISSIONS = {
  WORKSPACE_DELETE: 'workspace:delete',
  WORKSPACE_MANAGE_MEMBERS: 'workspace:manage_members',
  WORKSPACE_MANAGE_SETTINGS: 'workspace:manage_settings',
  FOLDER_CREATE: 'folder:create',
  FOLDER_DELETE: 'folder:delete',
  FOLDER_EDIT: 'folder:edit',
  FOLDER_VIEW: 'folder:view',
  NOTE_CREATE: 'note:create',
  NOTE_DELETE: 'note:delete',
  NOTE_EDIT: 'note:edit',
  NOTE_VIEW: 'note:view',
  NOTE_EXPORT: 'note:export',
  COMMENT_CREATE: 'comment:create',
  COMMENT_RESOLVE: 'comment:resolve',
  COMMENT_DELETE: 'comment:delete',
  VERSION_ROLLBACK: 'version:rollback',
  HISTORY_VIEW: 'history:view',
  TAG_MANAGE: 'tag:manage',
  TEMPLATE_MANAGE: 'template:manage',
  AUDIT_VIEW: 'audit:view',
  INVITE_CREATE: 'invite:create',
  SEARCH_USE: 'search:use',
};

const ROLE_PERMISSIONS = {
  [ROLES.OWNER]: Object.values(PERMISSIONS),
  [ROLES.ADMIN]: [
    PERMISSIONS.WORKSPACE_MANAGE_MEMBERS,
    PERMISSIONS.WORKSPACE_MANAGE_SETTINGS,
    PERMISSIONS.FOLDER_CREATE, PERMISSIONS.FOLDER_DELETE, PERMISSIONS.FOLDER_EDIT, PERMISSIONS.FOLDER_VIEW,
    PERMISSIONS.NOTE_CREATE, PERMISSIONS.NOTE_DELETE, PERMISSIONS.NOTE_EDIT, PERMISSIONS.NOTE_VIEW, PERMISSIONS.NOTE_EXPORT,
    PERMISSIONS.COMMENT_CREATE, PERMISSIONS.COMMENT_RESOLVE, PERMISSIONS.COMMENT_DELETE,
    PERMISSIONS.VERSION_ROLLBACK, PERMISSIONS.HISTORY_VIEW,
    PERMISSIONS.TAG_MANAGE, PERMISSIONS.TEMPLATE_MANAGE, PERMISSIONS.AUDIT_VIEW, PERMISSIONS.INVITE_CREATE,
    PERMISSIONS.SEARCH_USE,
  ],
  [ROLES.EDITOR]: [
    PERMISSIONS.FOLDER_CREATE, PERMISSIONS.FOLDER_EDIT, PERMISSIONS.FOLDER_VIEW,
    PERMISSIONS.NOTE_CREATE, PERMISSIONS.NOTE_EDIT, PERMISSIONS.NOTE_VIEW, PERMISSIONS.NOTE_EXPORT,
    PERMISSIONS.COMMENT_CREATE, PERMISSIONS.COMMENT_RESOLVE,
    PERMISSIONS.HISTORY_VIEW,
    PERMISSIONS.TAG_MANAGE, PERMISSIONS.SEARCH_USE,
  ],
  [ROLES.VIEWER]: [
    PERMISSIONS.FOLDER_VIEW, PERMISSIONS.NOTE_VIEW, PERMISSIONS.COMMENT_CREATE,
    PERMISSIONS.HISTORY_VIEW, PERMISSIONS.SEARCH_USE, PERMISSIONS.NOTE_EXPORT,
  ],
  [ROLES.GUEST]: [
    PERMISSIONS.FOLDER_VIEW, PERMISSIONS.NOTE_VIEW, PERMISSIONS.SEARCH_USE,
  ],
};

function getRolePermissions(role) {
  return ROLE_PERMISSIONS[role] || [];
}

function hasPermission(role, permission) {
  return getRolePermissions(role).includes(permission);
}

function getWorkspaceRole(userId, workspace) {
  if (!workspace) return null;
  if (workspace.ownerId === userId) return ROLES.OWNER;
  if (workspace.admins?.includes(userId)) return ROLES.ADMIN;
  if (workspace.editors?.includes(userId)) return ROLES.EDITOR;
  if (workspace.viewers?.includes(userId)) return ROLES.VIEWER;
  if (workspace.guests?.includes(userId)) return ROLES.GUEST;
  return null;
}

function getEffectiveRole(userId, workspace, overrides = {}) {
  const wsRole = getWorkspaceRole(userId, workspace);
  const resourceRoles = Object.values(overrides);
  const roleRank = { [ROLES.OWNER]: 5, [ROLES.ADMIN]: 4, [ROLES.EDITOR]: 3, [ROLES.VIEWER]: 2, [ROLES.GUEST]: 1, null: 0 };
  let effective = wsRole || null;
  for (const r of resourceRoles) {
    if (roleRank[r] > roleRank[effective]) effective = r;
  }
  return effective;
}

module.exports = { ROLES, PERMISSIONS, ROLE_PERMISSIONS, getRolePermissions, hasPermission, getWorkspaceRole, getEffectiveRole };
