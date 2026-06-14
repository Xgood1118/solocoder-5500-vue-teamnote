const { verifyToken, extractToken } = require('../utils/auth');
const { store } = require('../storage/jsonStore');
const { sendError, AppError } = require('../utils/common');
const { getWorkspaceRole, hasPermission, ROLES, PERMISSIONS } = require('./permissions');

function authenticate(req, res, next) {
  const token = extractToken(req);
  if (!token) return sendError(res, new AppError('未登录', 401, 'AUTH_REQUIRED'));
  const payload = verifyToken(token);
  if (!payload) return sendError(res, new AppError('登录已过期', 401, 'TOKEN_EXPIRED'));
  const user = store.get('users', payload.userId);
  if (!user) return sendError(res, new AppError('用户不存在', 401, 'USER_NOT_FOUND'));
  req.user = { id: user.id, username: user.username, name: user.name, email: user.email, avatar: user.avatar, role: user.role };
  next();
}

function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const user = store.get('users', payload.userId);
      if (user) req.user = { id: user.id, username: user.username, name: user.name, email: user.email, avatar: user.avatar, role: user.role };
    }
  }
  next();
}

function requireWorkspacePermission(permission, getWorkspaceId = req => req.params.workspaceId || req.body.workspaceId) {
  return (req, res, next) => {
    const wsId = getWorkspaceId(req);
    if (!wsId) return sendError(res, new AppError('缺少 workspaceId', 400, 'BAD_REQUEST'));
    const ws = store.get('workspaces', wsId);
    if (!ws) return sendError(res, new AppError('工作空间不存在', 404, 'NOT_FOUND'));
    const role = getWorkspaceRole(req.user.id, ws);
    if (!role) return sendError(res, new AppError('无访问权限', 403, 'FORBIDDEN'));
    if (!hasPermission(role, permission)) {
      return sendError(res, new AppError('权限不足', 403, 'PERMISSION_DENIED'));
    }
    req.workspace = ws;
    req.workspaceRole = role;
    next();
  };
}

function requireResourcePermission(resourceType, permission, getResourceId) {
  return (req, res, next) => {
    const id = typeof getResourceId === 'function' ? getResourceId(req) : (req.params.id || req.body.id);
    const resource = store.get(resourceType, id);
    if (!resource) return sendError(res, new AppError('资源不存在', 404, 'NOT_FOUND'));
    const ws = store.get('workspaces', resource.workspaceId);
    if (!ws) return sendError(res, new AppError('工作空间不存在', 404, 'NOT_FOUND'));
    const role = getWorkspaceRole(req.user.id, ws);
    if (!role) return sendError(res, new AppError('无访问权限', 403, 'FORBIDDEN'));
    if (!hasPermission(role, permission)) {
      return sendError(res, new AppError('权限不足', 403, 'PERMISSION_DENIED'));
    }
    req.workspace = ws;
    req.workspaceRole = role;
    req[resourceType] = resource;
    next();
  };
}

module.exports = { authenticate, optionalAuth, requireWorkspacePermission, requireResourcePermission };
