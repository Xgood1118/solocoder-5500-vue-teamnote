const { store } = require('../storage/jsonStore');
const { generateId, now, AppError, asyncHandler, sendSuccess } = require('../utils/common');
const { getWorkspaceRole, hasPermission, ROLES, PERMISSIONS } = require('../middleware/permissions');
const { notificationService } = require('../services/notification');
const { auditService, ACTIONS } = require('../services/audit');

exports.listMyWorkspaces = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const all = store.findAll('workspaces');
  const mine = all.filter(w => w.ownerId === userId || (w.admins || []).includes(userId) || (w.editors || []).includes(userId) || (w.viewers || []).includes(userId) || (w.guests || []).includes(userId));
  const result = mine.map(w => ({
    ...w,
    myRole: getWorkspaceRole(userId, w),
    memberCount: 1 + (w.admins?.length || 0) + (w.editors?.length || 0) + (w.viewers?.length || 0) + (w.guests?.length || 0),
    folderCount: store.count('folders', f => f.workspaceId === w.id),
    noteCount: store.count('notes', n => n.workspaceId === w.id),
  }));
  sendSuccess(res, { items: result });
});

exports.createWorkspace = asyncHandler(async (req, res) => {
  const { name, description = '', icon = '📁' } = req.body || {};
  if (!name) throw new AppError('工作空间名称必填', 400, 'BAD_REQUEST');
  const id = generateId('ws_');
  const ws = {
    id, name, description, icon,
    ownerId: req.user.id,
    admins: [], editors: [], viewers: [], guests: [],
    createdAt: now(), updatedAt: now(),
  };
  store.insert('workspaces', id, ws);
  const user = store.get('users', req.user.id);
  if (user) {
    const ids = new Set(user.workspaceIds || []);
    ids.add(id);
    store.update('users', user.id, { workspaceIds: [...ids], updatedAt: now() });
  }
  auditService.log({ action: ACTIONS.WORKSPACE_CREATE, userId: req.user.id, workspaceId: id, resourceId: id, ip: req.ip });
  sendSuccess(res, { workspace: ws }, '创建成功');
});

exports.getWorkspace = asyncHandler(async (req, res) => {
  const ws = req.workspace;
  const memberIds = [ws.ownerId, ...(ws.admins || []), ...(ws.editors || []), ...(ws.viewers || []), ...(ws.guests || [])];
  const users = Object.fromEntries(
    store.findAll('users', u => memberIds.includes(u.id)).map(u => [u.id, { id: u.id, name: u.name, username: u.username, avatar: u.avatar, email: u.email }])
  );
  const roleMap = {};
  for (const id of memberIds) roleMap[id] = getWorkspaceRole(id, ws);
  sendSuccess(res, { workspace: ws, users, roleMap });
});

exports.updateWorkspace = asyncHandler(async (req, res) => {
  const { name, description, icon } = req.body || {};
  const patch = { updatedAt: now() };
  if (name !== undefined) patch.name = name;
  if (description !== undefined) patch.description = description;
  if (icon !== undefined) patch.icon = icon;
  const ws = store.update('workspaces', req.workspace.id, patch);
  auditService.log({ action: ACTIONS.WORKSPACE_UPDATE, userId: req.user.id, workspaceId: ws.id, resourceId: ws.id, details: patch, ip: req.ip });
  sendSuccess(res, { workspace: ws }, '更新成功');
});

exports.deleteWorkspace = asyncHandler(async (req, res) => {
  const ws = req.workspace;
  const folders = store.findAll('folders', f => f.workspaceId === ws.id);
  const notes = store.findAll('notes', n => n.workspaceId === ws.id);
  for (const n of notes) store.remove('notes', n.id);
  for (const f of folders) store.remove('folders', f.id);
  store.remove('workspaces', ws.id);
  auditService.log({ action: ACTIONS.WORKSPACE_DELETE, userId: req.user.id, workspaceId: ws.id, resourceId: ws.id, ip: req.ip });
  sendSuccess(res, null, '已删除');
});

exports.updateMemberRole = asyncHandler(async (req, res) => {
  const { userId, role } = req.body || {};
  if (!userId || !role) throw new AppError('userId 和 role 必填', 400, 'BAD_REQUEST');
  if (!Object.values(ROLES).includes(role)) throw new AppError('无效角色', 400, 'BAD_REQUEST');
  if (role === ROLES.OWNER) throw new AppError('不能设置为owner，请使用转让接口', 400, 'BAD_REQUEST');
  const ws = { ...req.workspace };
  const fields = { admin: 'admins', editor: 'editors', viewer: 'viewers', guest: 'guests' };
  for (const f of Object.values(fields)) {
    if (ws[f]) ws[f] = ws[f].filter(id => id !== userId);
  }
  if (fields[role]) {
    if (!ws[fields[role]]) ws[fields[role]] = [];
    ws[fields[role]].push(userId);
  }
  ws.updatedAt = now();
  store.update('workspaces', ws.id, ws);
  const user = store.get('users', userId);
  if (user && !user.workspaceIds?.includes(ws.id)) {
    const ids = new Set(user.workspaceIds || []);
    ids.add(ws.id);
    store.update('users', userId, { workspaceIds: [...ids] });
  }
  auditService.log({ action: ACTIONS.WORKSPACE_MEMBER_ROLE_CHANGE, userId: req.user.id, workspaceId: ws.id, resourceId: userId, details: { role }, ip: req.ip });
  sendSuccess(res, { workspace: ws }, '角色已更新');
});

exports.removeMember = asyncHandler(async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) throw new AppError('userId 必填', 400, 'BAD_REQUEST');
  if (userId === req.workspace.ownerId) throw new AppError('不能移除所有者', 400, 'BAD_REQUEST');
  const ws = { ...req.workspace };
  ws.admins = (ws.admins || []).filter(id => id !== userId);
  ws.editors = (ws.editors || []).filter(id => id !== userId);
  ws.viewers = (ws.viewers || []).filter(id => id !== userId);
  ws.guests = (ws.guests || []).filter(id => id !== userId);
  ws.updatedAt = now();
  store.update('workspaces', ws.id, ws);
  auditService.log({ action: ACTIONS.WORKSPACE_MEMBER_REMOVE, userId: req.user.id, workspaceId: ws.id, resourceId: userId, ip: req.ip });
  sendSuccess(res, { workspace: ws }, '已移除成员');
});

exports.createInviteLink = asyncHandler(async (req, res) => {
  const { role = 'viewer', maxUses = 10, expiresHours = 24 * 7 } = req.body || {};
  if (!Object.values(ROLES).includes(role)) throw new AppError('无效角色', 400, 'BAD_REQUEST');
  const id = generateId('inv_');
  const token = Buffer.from(`${id}-${Date.now()}-${Math.random()}`).toString('base64').replace(/=/g, '');
  const expiresAt = expiresHours ? new Date(Date.now() + expiresHours * 3600 * 1000).toISOString() : null;
  const invite = {
    id, token, workspaceId: req.workspace.id,
    defaultRole: role, maxUses, useCount: 0,
    expiresAt, revoked: false,
    createdBy: req.user.id, createdAt: now(),
  };
  store.insert('inviteLinks', id, invite);
  auditService.log({ action: ACTIONS.INVITE_CREATE, userId: req.user.id, workspaceId: req.workspace.id, resourceId: id, details: { role }, ip: req.ip });
  sendSuccess(res, { invite }, '邀请链接已生成');
});

exports.listInviteLinks = asyncHandler(async (req, res) => {
  const list = store.findAll('inviteLinks', inv => inv.workspaceId === req.workspace.id);
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  sendSuccess(res, { items: list });
});

exports.revokeInviteLink = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const inv = store.get('inviteLinks', id);
  if (!inv || inv.workspaceId !== req.workspace.id) throw new AppError('邀请链接不存在', 404, 'NOT_FOUND');
  store.update('inviteLinks', id, { revoked: true });
  auditService.log({ action: ACTIONS.INVITE_REVOKE, userId: req.user.id, workspaceId: req.workspace.id, resourceId: id, ip: req.ip });
  sendSuccess(res, null, '已撤销');
});

exports.transferOwnership = asyncHandler(async (req, res) => {
  const { newOwnerId } = req.body || {};
  if (!newOwnerId) throw new AppError('newOwnerId 必填', 400, 'BAD_REQUEST');
  const ws = { ...req.workspace };
  const role = getWorkspaceRole(req.user.id, ws);
  if (role !== ROLES.OWNER) throw new AppError('只有所有者可转让', 403, 'FORBIDDEN');
  const newOwnerRole = getWorkspaceRole(newOwnerId, ws);
  if (!newOwnerRole) throw new AppError('新所有者必须是工作空间成员', 400, 'BAD_REQUEST');
  const oldOwner = ws.ownerId;
  if (ws.admins?.includes(newOwnerId)) ws.admins = ws.admins.filter(id => id !== newOwnerId);
  if (ws.editors?.includes(newOwnerId)) ws.editors = ws.editors.filter(id => id !== newOwnerId);
  if (ws.viewers?.includes(newOwnerId)) ws.viewers = ws.viewers.filter(id => id !== newOwnerId);
  if (ws.guests?.includes(newOwnerId)) ws.guests = ws.guests.filter(id => id !== newOwnerId);
  if (!ws.admins) ws.admins = [];
  ws.admins.push(oldOwner);
  ws.ownerId = newOwnerId;
  ws.updatedAt = now();
  store.update('workspaces', ws.id, ws);
  auditService.log({ action: ACTIONS.WORKSPACE_MEMBER_ROLE_CHANGE, userId: req.user.id, workspaceId: ws.id, details: { oldOwner, newOwner: newOwnerId }, ip: req.ip });
  sendSuccess(res, { workspace: ws }, '所有权已转让');
});

exports.getAuditLogs = asyncHandler(async (req, res) => {
  const result = auditService.query({ workspaceId: req.workspace.id, ...req.query });
  sendSuccess(res, result);
});
