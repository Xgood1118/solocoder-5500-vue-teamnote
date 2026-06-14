const { store } = require('../storage/jsonStore');
const { generateId, now, AppError, asyncHandler, sendSuccess } = require('../utils/common');
const { auditService, ACTIONS } = require('../services/audit');
const { notificationService } = require('../services/notification');

exports.listByNote = asyncHandler(async (req, res) => {
  const { noteId } = req.params;
  let list = store.findAll('comments', c => c.noteId === noteId);
  const { blockId, resolved } = req.query;
  if (blockId) list = list.filter(c => c.blockId === blockId || c.parentId && (store.get('comments', c.parentId)?.blockId === blockId));
  if (resolved !== undefined) {
    const want = resolved === 'true';
    list = list.filter(c => c.parentId || (!!c.resolved) === want);
  }
  list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const userIds = [...new Set(list.map(c => c.createdBy))];
  const users = Object.fromEntries(
    store.findAll('users', u => userIds.includes(u.id)).map(u => [u.id, { id: u.id, name: u.name, username: u.username, avatar: u.avatar }])
  );
  sendSuccess(res, { items: list, users });
});

exports.create = asyncHandler(async (req, res) => {
  const { noteId, blockId, content, parentId = null } = req.body || {};
  if (!noteId || !content) throw new AppError('noteId 和 content 必填', 400, 'BAD_REQUEST');
  const note = store.get('notes', noteId);
  if (!note) throw new AppError('笔记不存在', 404, 'NOT_FOUND');
  const id = generateId('c_');
  const comment = {
    id, noteId, blockId: blockId || null, parentId,
    content, createdBy: req.user.id,
    resolved: false, resolvedBy: null, resolvedAt: null,
    createdAt: now(), updatedAt: now(),
  };
  store.insert('comments', id, comment);
  const count = store.count('comments', c => c.noteId === noteId && !c.parentId);
  store.update('notes', noteId, { comments: count, updatedAt: now() });
  const ws = store.get('workspaces', note.workspaceId);
  notificationService.notifyMentions(ws, note, content, id, req.user.id);
  auditService.log({ action: ACTIONS.COMMENT_CREATE, userId: req.user.id, workspaceId: note.workspaceId, resourceId: noteId, details: { commentId: id, blockId }, ip: req.ip });
  sendSuccess(res, { comment }, '评论成功');
});

exports.update = asyncHandler(async (req, res) => {
  const { content } = req.body || {};
  const c = store.get('comments', req.params.id);
  if (!c) throw new AppError('评论不存在', 404, 'NOT_FOUND');
  if (c.createdBy !== req.user.id) throw new AppError('只能编辑自己的评论', 403, 'FORBIDDEN');
  const record = store.update('comments', req.params.id, { content, updatedAt: now() });
  sendSuccess(res, { comment: record }, '已更新');
});

exports.resolve = asyncHandler(async (req, res) => {
  const c = store.get('comments', req.params.id);
  if (!c) throw new AppError('评论不存在', 404, 'NOT_FOUND');
  const patch = c.resolved
    ? { resolved: false, resolvedBy: null, resolvedAt: null }
    : { resolved: true, resolvedBy: req.user.id, resolvedAt: now() };
  const record = store.update('comments', req.params.id, patch);
  const note = store.get('notes', c.noteId);
  auditService.log({ action: c.resolved ? ACTIONS.COMMENT_REOPEN : ACTIONS.COMMENT_RESOLVE, userId: req.user.id, workspaceId: note?.workspaceId, resourceId: c.id, ip: req.ip });
  sendSuccess(res, { comment: record }, c.resolved ? '已重新打开' : '已标记解决');
});

exports.remove = asyncHandler(async (req, res) => {
  const c = store.get('comments', req.params.id);
  if (!c) throw new AppError('评论不存在', 404, 'NOT_FOUND');
  if (c.createdBy !== req.user.id) throw new AppError('只能删除自己的评论', 403, 'FORBIDDEN');
  const childs = store.findAll('comments', cc => cc.parentId === c.id);
  for (const ch of childs) store.remove('comments', ch.id);
  store.remove('comments', c.id);
  const count = store.count('comments', cc => cc.noteId === c.noteId && !cc.parentId);
  if (c.noteId) store.update('notes', c.noteId, { comments: count });
  const note = store.get('notes', c.noteId);
  auditService.log({ action: ACTIONS.COMMENT_DELETE, userId: req.user.id, workspaceId: note?.workspaceId, resourceId: c.id, ip: req.ip });
  sendSuccess(res, null, '已删除');
});
