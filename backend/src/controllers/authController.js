const { store } = require('../storage/jsonStore');
const { generateId, now, AppError, asyncHandler, sendSuccess } = require('../utils/common');
const { hashPassword, verifyPassword, signToken, verifyToken } = require('../utils/auth');
const { notificationService } = require('../services/notification');
const { auditService, ACTIONS } = require('../services/audit');

exports.register = asyncHandler(async (req, res) => {
  const { username, password, name, email } = req.body || {};
  if (!username || !password) throw new AppError('用户名和密码必填', 400, 'BAD_REQUEST');
  if (password.length < 6) throw new AppError('密码至少6位', 400, 'BAD_REQUEST');
  if (store.findOne('users', u => u.username === username)) {
    throw new AppError('用户名已存在', 400, 'USER_EXISTS');
  }
  const id = generateId('u_');
  const user = {
    id, username, password: hashPassword(password),
    name: name || username, email: email || '',
    avatar: '', role: 'viewer', workspaceIds: [],
    createdAt: now(), updatedAt: now(),
  };
  store.insert('users', id, user);
  const token = signToken({ userId: id, username });
  auditService.log({ action: ACTIONS.LOGIN, userId: id, ip: req.ip });
  sendSuccess(res, { token, user: sanitizeUser(user) }, '注册成功');
});

exports.login = asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) throw new AppError('用户名和密码必填', 400, 'BAD_REQUEST');
  const user = store.findOne('users', u => u.username === username);
  if (!user || !verifyPassword(password, user.password)) {
    throw new AppError('用户名或密码错误', 401, 'AUTH_FAILED');
  }
  const token = signToken({ userId: user.id, username: user.username });
  auditService.log({ action: ACTIONS.LOGIN, userId: user.id, ip: req.ip });
  sendSuccess(res, { token, user: sanitizeUser(user) }, '登录成功');
});

exports.loginWithInvite = asyncHandler(async (req, res) => {
  const { token: inviteToken, username, password, name, email } = req.body || {};
  if (!inviteToken) throw new AppError('邀请链接无效', 400, 'BAD_REQUEST');
  const invite = store.findOne('inviteLinks', inv => inv.token === inviteToken && !inv.revoked);
  if (!invite) throw new AppError('邀请链接无效或已过期', 400, 'INVITE_INVALID');
  if (invite.expiresAt && invite.expiresAt < now()) throw new AppError('邀请链接已过期', 400, 'INVITE_EXPIRED');
  if (invite.maxUses && invite.useCount >= invite.maxUses) throw new AppError('邀请链接已达使用上限', 400, 'INVITE_LIMIT');

  let user;
  const userId = generateId('u_');
  user = {
    id: userId, username, password: hashPassword(password),
    name: name || username, email: email || '',
    avatar: '', role: invite.defaultRole || 'viewer',
    workspaceIds: [invite.workspaceId],
    createdAt: now(), updatedAt: now(),
  };
  store.insert('users', userId, user);

  const ws = store.get('workspaces', invite.workspaceId);
  if (ws) {
    const roleField = invite.defaultRole === 'owner' ? 'ownerId' :
      invite.defaultRole === 'admin' ? 'admins' :
      invite.defaultRole === 'editor' ? 'editors' :
      invite.defaultRole === 'viewer' ? 'viewers' : 'guests';
    if (roleField === 'ownerId') ws.ownerId = userId;
    else {
      if (!ws[roleField]) ws[roleField] = [];
      if (!ws[roleField].includes(userId)) ws[roleField].push(userId);
    }
    store.update('workspaces', ws.id, ws);
  }

  invite.useCount = (invite.useCount || 0) + 1;
  store.update('inviteLinks', invite.id, invite);
  notificationService.notifyInviteAccepted(invite.id, invite.createdBy, user.name);
  auditService.log({ action: ACTIONS.INVITE_ACCEPT, userId, workspaceId: invite.workspaceId, resourceId: invite.id, details: { role: invite.defaultRole } });

  const token = signToken({ userId, username });
  auditService.log({ action: ACTIONS.LOGIN, userId, ip: req.ip });
  sendSuccess(res, { token, user: sanitizeUser(user) }, '加入成功');
});

exports.profile = asyncHandler(async (req, res) => {
  const user = store.get('users', req.user.id);
  if (!user) throw new AppError('用户不存在', 404, 'NOT_FOUND');
  const unread = notificationService.unreadCount(user.id);
  sendSuccess(res, { user: sanitizeUser(user), unreadNotifications: unread });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, email, avatar } = req.body || {};
  const patch = { updatedAt: now() };
  if (name !== undefined) patch.name = name;
  if (email !== undefined) patch.email = email;
  if (avatar !== undefined) patch.avatar = avatar;
  const user = store.update('users', req.user.id, patch);
  sendSuccess(res, { user: sanitizeUser(user) }, '更新成功');
});

exports.changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  const user = store.get('users', req.user.id);
  if (!verifyPassword(oldPassword, user.password)) throw new AppError('原密码错误', 400, 'BAD_PASSWORD');
  if (!newPassword || newPassword.length < 6) throw new AppError('新密码至少6位', 400, 'BAD_PASSWORD');
  store.update('users', req.user.id, { password: hashPassword(newPassword), updatedAt: now() });
  sendSuccess(res, null, '密码已更新');
});

function sanitizeUser(u) {
  if (!u) return null;
  const { password, ...rest } = u;
  return rest;
}
