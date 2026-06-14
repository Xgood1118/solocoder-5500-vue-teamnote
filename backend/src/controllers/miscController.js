const { store } = require('../storage/jsonStore');
const { generateId, now, asyncHandler, sendSuccess, AppError } = require('../utils/common');
const { searchService } = require('../services/search');
const { auditService, ACTIONS } = require('../services/audit');
const { notificationService } = require('../services/notification');

exports.searchNotes = asyncHandler(async (req, res) => {
  const { q, workspaceId, limit = 50, offset = 0 } = req.query;
  if (!q) return sendSuccess(res, { total: 0, items: [], users: {} });
  const result = searchService.searchNotes(q, { workspaceId, limit: Number(limit), offset: Number(offset) });
  if (workspaceId) searchService.recordHistory(req.user.id, workspaceId, q);
  sendSuccess(res, result);
});

exports.history = asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  sendSuccess(res, { items: searchService.getHistory(req.user.id, workspaceId, Number(req.query.limit || 20)) });
});

exports.clearHistory = asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const n = searchService.clearHistory(req.user.id, workspaceId);
  sendSuccess(res, { cleared: n }, '已清除');
});

exports.hotTerms = asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  sendSuccess(res, { items: searchService.getHotTerms(workspaceId, Number(req.query.limit || 20)) });
});

exports.listTags = asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  let list = store.findAll('tags');
  list.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
  sendSuccess(res, { items: list });
});

exports.createTag = asyncHandler(async (req, res) => {
  const { name, color } = req.body || {};
  if (!name) throw new AppError('标签名称必填', 400, 'BAD_REQUEST');
  const existing = store.findOne('tags', t => t.name === name);
  if (existing) return sendSuccess(res, { tag: existing });
  const id = generateId('tag_');
  const tag = { id, name, color: color || `hsl(${Math.floor(Math.random() * 360)}, 70%, 60%)`, usageCount: 0, createdBy: req.user.id, createdAt: now() };
  store.insert('tags', id, tag);
  auditService.log({ action: ACTIONS.TAG_CREATE, userId: req.user.id, resourceId: id, ip: req.ip });
  sendSuccess(res, { tag }, '创建成功');
});

exports.deleteTag = asyncHandler(async (req, res) => {
  store.remove('tags', req.params.id);
  auditService.log({ action: ACTIONS.TAG_DELETE, userId: req.user.id, resourceId: req.params.id, ip: req.ip });
  sendSuccess(res, null, '已删除');
});

exports.listTemplates = asyncHandler(async (req, res) => {
  const list = store.findAll('templates');
  const groups = {};
  for (const t of list) {
    const g = t.category || '其他';
    if (!groups[g]) groups[g] = [];
    groups[g].push(t);
  }
  sendSuccess(res, { groups, items: list });
});

exports.createTemplate = asyncHandler(async (req, res) => {
  const { name, icon, category, content } = req.body || {};
  if (!name || !content) throw new AppError('名称和内容必填', 400, 'BAD_REQUEST');
  const id = generateId('tpl_');
  const tpl = { id, name, icon: icon || '📄', category: category || '自定义', content, isSystem: false, createdBy: req.user.id, createdAt: now() };
  store.insert('templates', id, tpl);
  auditService.log({ action: ACTIONS.TEMPLATE_CREATE, userId: req.user.id, resourceId: id, ip: req.ip });
  sendSuccess(res, { template: tpl }, '创建成功');
});

exports.updateTemplate = asyncHandler(async (req, res) => {
  const tpl = store.get('templates', req.params.id);
  if (tpl?.isSystem) throw new AppError('系统模板不能修改', 403, 'FORBIDDEN');
  const { name, icon, category, content } = req.body || {};
  const patch = { updatedAt: now() };
  if (name !== undefined) patch.name = name;
  if (icon !== undefined) patch.icon = icon;
  if (category !== undefined) patch.category = category;
  if (content !== undefined) patch.content = content;
  const t = store.update('templates', req.params.id, patch);
  sendSuccess(res, { template: t }, '更新成功');
});

exports.deleteTemplate = asyncHandler(async (req, res) => {
  const tpl = store.get('templates', req.params.id);
  if (tpl?.isSystem) throw new AppError('系统模板不能删除', 403, 'FORBIDDEN');
  store.remove('templates', req.params.id);
  auditService.log({ action: ACTIONS.TEMPLATE_DELETE, userId: req.user.id, resourceId: req.params.id, ip: req.ip });
  sendSuccess(res, null, '已删除');
});

exports.listNotifications = asyncHandler(async (req, res) => {
  const { limit = 50, offset = 0, unreadOnly = 'false' } = req.query;
  const result = notificationService.listByUser(req.user.id, { limit: Number(limit), offset: Number(offset), unreadOnly: unreadOnly === 'true' });
  const fromIds = [...new Set(result.items.map(n => n.fromUserId).filter(Boolean))];
  const users = Object.fromEntries(
    store.findAll('users', u => fromIds.includes(u.id)).map(u => [u.id, { id: u.id, name: u.name, username: u.username, avatar: u.avatar }])
  );
  sendSuccess(res, { ...result, users, unreadCount: notificationService.unreadCount(req.user.id) });
});

exports.markNotificationRead = asyncHandler(async (req, res) => {
  notificationService.markRead(req.user.id, req.params.id);
  sendSuccess(res, null, '已标记已读');
});

exports.markAllNotificationsRead = asyncHandler(async (req, res) => {
  const n = notificationService.markAllRead(req.user.id);
  sendSuccess(res, { count: n }, '已全部标为已读');
});

exports.listUsers = asyncHandler(async (req, res) => {
  const { workspaceId, q = '' } = req.query;
  let users = store.findAll('users');
  if (workspaceId) users = users.filter(u => u.workspaceIds?.includes(workspaceId));
  if (q) {
    const kw = q.toLowerCase();
    users = users.filter(u => u.name?.toLowerCase().includes(kw) || u.username?.toLowerCase().includes(kw) || u.email?.toLowerCase().includes(kw));
  }
  const items = users.map(u => ({ id: u.id, username: u.username, name: u.name, email: u.email, avatar: u.avatar }));
  sendSuccess(res, { items });
});
