const { store } = require('../storage/jsonStore');
const { generateId, now, AppError, asyncHandler, sendSuccess } = require('../utils/common');
const { auditService, ACTIONS } = require('../services/audit');
const { notificationService } = require('../services/notification');

exports.listByFolder = asyncHandler(async (req, res) => {
  const { folderId } = req.params;
  const list = store.findAll('notes', n => n.folderId === folderId);
  list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  sendSuccess(res, { items: list });
});

exports.listByWorkspace = asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { keyword = '', tag = '', sort = 'updatedAt', limit = 50, offset = 0 } = req.query;
  let list = store.findAll('notes', n => n.workspaceId === workspaceId);
  if (keyword) {
    const kw = keyword.toLowerCase();
    list = list.filter(n => n.title?.toLowerCase().includes(kw));
  }
  if (tag) list = list.filter(n => (n.tags || []).includes(tag));
  list.sort((a, b) => {
    if (sort === 'createdAt') return new Date(b.createdAt) - new Date(a.createdAt);
    if (sort === 'title') return a.title.localeCompare(b.title);
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
  const total = list.length;
  const items = list.slice(Number(offset), Number(offset) + Number(limit));
  sendSuccess(res, { total, items });
});

exports.recent = asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const limit = Number(req.query.limit || 20);
  let list = store.findAll('notes', n => n.workspaceId === workspaceId);
  list.sort((a, b) => new Date(b.lastActiveAt || b.updatedAt) - new Date(a.lastActiveAt || a.updatedAt));
  sendSuccess(res, { items: list.slice(0, limit) });
});

exports.get = asyncHandler(async (req, res) => {
  const note = store.get('notes', req.params.id);
  if (!note) throw new AppError('笔记不存在', 404, 'NOT_FOUND');
  note.lastActiveAt = now();
  store.update('notes', note.id, { lastActiveAt: note.lastActiveAt });
  const versions = store.findAll('noteVersions', v => v.noteId === note.id).sort((a, b) => b.version - a.version).slice(0, 20);
  const comments = store.findAll('comments', c => c.noteId === note.id && !c.parentId);
  const commentCount = comments.length;
  sendSuccess(res, { note, versions, comments });
});

exports.create = asyncHandler(async (req, res) => {
  const { workspaceId, folderId, title, content = '', tags = [], templateId = null } = req.body || {};
  if (!workspaceId) throw new AppError('workspaceId 必填', 400, 'BAD_REQUEST');
  let tplContent = '';
  if (templateId) {
    const tpl = store.get('templates', templateId);
    if (tpl) tplContent = tpl.content;
  }
  const id = generateId('n_');
  const note = {
    id, workspaceId, folderId: folderId || null,
    title: title || '未命名笔记',
    tags, blocks: [{ id: generateId('b_'), type: 'markdown', content: tplContent || content }],
    ydocVersion: 0, ydocState: null,
    createdBy: req.user.id, updatedBy: req.user.id,
    lastActiveAt: now(), versions: [], comments: 0,
    createdAt: now(), updatedAt: now(),
  };
  store.insert('notes', id, note);
  if (folderId) {
    const f = store.get('folders', folderId);
    if (f) {
      const ids = new Set(f.noteIds || []);
      ids.add(id);
      store.update('folders', folderId, { noteIds: [...ids], updatedAt: now() });
    }
  }
  auditService.log({ action: ACTIONS.NOTE_CREATE, userId: req.user.id, workspaceId, resourceId: id, ip: req.ip });
  sendSuccess(res, { note }, '创建成功');
});

exports.update = asyncHandler(async (req, res) => {
  const { title, tags, blocks } = req.body || {};
  const patch = { updatedBy: req.user.id, updatedAt: now() };
  if (title !== undefined) patch.title = title;
  if (tags !== undefined) patch.tags = tags;
  if (blocks !== undefined) patch.blocks = blocks;
  const note = store.update('notes', req.params.id, patch);
  auditService.log({ action: ACTIONS.NOTE_UPDATE, userId: req.user.id, workspaceId: note.workspaceId, resourceId: note.id, details: Object.keys(patch), ip: req.ip });
  sendSuccess(res, { note }, '更新成功');
});

exports.remove = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const note = store.get('notes', id);
  if (!note) throw new AppError('笔记不存在', 404, 'NOT_FOUND');
  if (note.folderId) {
    const f = store.get('folders', note.folderId);
    if (f) store.update('folders', note.folderId, { noteIds: (f.noteIds || []).filter(n => n !== id), updatedAt: now() });
  }
  store.remove('notes', id);
  const vs = store.findAll('noteVersions', v => v.noteId === id);
  for (const v of vs) store.remove('noteVersions', v.id);
  const cs = store.findAll('comments', c => c.noteId === id);
  for (const c of cs) store.remove('comments', c.id);
  auditService.log({ action: ACTIONS.NOTE_DELETE, userId: req.user.id, workspaceId: note.workspaceId, resourceId: id, ip: req.ip });
  sendSuccess(res, null, '已删除');
});

exports.saveVersion = asyncHandler(async (req, res) => {
  const { label = '' } = req.body || {};
  const note = store.get('notes', req.params.id);
  if (!note) throw new AppError('笔记不存在', 404, 'NOT_FOUND');
  const versions = store.findAll('noteVersions', v => v.noteId === note.id);
  const nextVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version)) + 1 : 1;
  const id = generateId('v_');
  const snapshot = {
    id, noteId: note.id, version: nextVersion, label,
    title: note.title, tags: note.tags, blocks: note.blocks,
    ydocState: note.ydocState,
    createdBy: req.user.id, createdAt: now(),
  };
  store.insert('noteVersions', id, snapshot);
  store.update('notes', note.id, { ydocVersion: nextVersion, updatedAt: now() });
  auditService.log({ action: ACTIONS.NOTE_UPDATE, userId: req.user.id, workspaceId: note.workspaceId, resourceId: note.id, details: { snapshotVersion: nextVersion }, ip: req.ip });
  sendSuccess(res, { version: snapshot }, '版本已保存');
});

exports.listVersions = asyncHandler(async (req, res) => {
  const list = store.findAll('noteVersions', v => v.noteId === req.params.id);
  list.sort((a, b) => b.version - a.version);
  const userIds = [...new Set(list.map(v => v.createdBy))];
  const users = Object.fromEntries(
    store.findAll('users', u => userIds.includes(u.id)).map(u => [u.id, { id: u.id, name: u.name, username: u.username }])
  );
  sendSuccess(res, { items: list, users });
});

exports.rollback = asyncHandler(async (req, res) => {
  const { versionId } = req.body || {};
  const note = store.get('notes', req.params.id);
  const v = store.get('noteVersions', versionId);
  if (!note || !v || v.noteId !== note.id) throw new AppError('版本不存在', 404, 'NOT_FOUND');
  const preSnap = { title: note.title, tags: note.tags, blocks: note.blocks };
  store.update('notes', note.id, { title: v.title, tags: v.tags, blocks: v.blocks, ydocState: v.ydocState, updatedBy: req.user.id, updatedAt: now() });
  auditService.log({ action: ACTIONS.NOTE_ROLLBACK, userId: req.user.id, workspaceId: note.workspaceId, resourceId: note.id, details: { version: v.version }, ip: req.ip });
  sendSuccess(res, { note: store.get('notes', note.id), before: preSnap }, '已回滚');
});

exports.share = asyncHandler(async (req, res) => {
  const { userId, permission = 'viewer' } = req.body || {};
  const note = store.get('notes', req.params.id);
  if (!note) throw new AppError('笔记不存在', 404, 'NOT_FOUND');
  if (!note.permissions) note.permissions = {};
  note.permissions[userId] = permission;
  store.update('notes', note.id, { permissions: note.permissions, updatedAt: now() });
  notificationService.notifyNoteShared(note.workspaceId, note, userId, req.user.id, permission);
  auditService.log({ action: ACTIONS.PERMISSION_CHANGE, userId: req.user.id, workspaceId: note.workspaceId, resourceId: note.id, details: { userId, permission }, ip: req.ip });
  sendSuccess(res, null, '已分享');
});
