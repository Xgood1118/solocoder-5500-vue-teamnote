const { store } = require('../storage/jsonStore');
const { generateId, now, AppError, asyncHandler, sendSuccess } = require('../utils/common');
const { auditService, ACTIONS } = require('../services/audit');

exports.listByWorkspace = asyncHandler(async (req, res) => {
  const wsId = req.params.workspaceId;
  const parentId = req.query.parentId || null;
  const list = store.findAll('folders', f => f.workspaceId === wsId && (parentId === 'null' ? !f.parentId : f.parentId === parentId));
  list.sort((a, b) => (a.order || 0) - (b.order || 0));
  const result = list.map(f => ({ ...f, noteCount: f.noteIds?.length || 0 }));
  sendSuccess(res, { items: result });
});

exports.getTree = asyncHandler(async (req, res) => {
  const wsId = req.params.workspaceId;
  const folders = store.findAll('folders', f => f.workspaceId === wsId);
  const notes = store.findAll('notes', n => n.workspaceId === wsId);
  const byParent = {};
  for (const f of folders) {
    const p = f.parentId || 'root';
    if (!byParent[p]) byParent[p] = { folders: [], notes: [] };
    byParent[p].folders.push({ ...f, type: 'folder', noteCount: f.noteIds?.length || 0 });
  }
  const notesByFolder = {};
  for (const n of notes) {
    const f = n.folderId || 'root';
    if (!notesByFolder[f]) notesByFolder[f] = [];
    notesByFolder[f].push({ ...n, type: 'note' });
  }
  function buildTree(parentId = 'root') {
    const node = byParent[parentId] || { folders: [], notes: [] };
    node.folders.sort((a, b) => (a.order || 0) - (b.order || 0));
    return {
      folders: node.folders.map(f => ({ ...f, children: buildTree(f.id), notes: notesByFolder[f.id] || [] })),
      notes: notesByFolder[parentId] || [],
    };
  }
  sendSuccess(res, buildTree());
});

exports.create = asyncHandler(async (req, res) => {
  const wsId = req.workspace.id;
  const { name, parentId = null, icon = '📁' } = req.body || {};
  if (!name) throw new AppError('文件夹名称必填', 400, 'BAD_REQUEST');
  const siblings = store.findAll('folders', f => f.workspaceId === wsId && (f.parentId || null) === (parentId || null));
  const id = generateId('f_');
  const folder = {
    id, workspaceId: wsId, parentId: parentId || null,
    name, icon, noteIds: [], order: siblings.length,
    createdAt: now(), updatedAt: now(),
  };
  store.insert('folders', id, folder);
  auditService.log({ action: ACTIONS.FOLDER_CREATE, userId: req.user.id, workspaceId: wsId, resourceId: id, ip: req.ip });
  sendSuccess(res, { folder }, '创建成功');
});

exports.update = asyncHandler(async (req, res) => {
  const { name, icon, order, parentId } = req.body || {};
  const patch = { updatedAt: now() };
  if (name !== undefined) patch.name = name;
  if (icon !== undefined) patch.icon = icon;
  if (order !== undefined) patch.order = order;
  if (parentId !== undefined) patch.parentId = parentId;
  const folder = store.update('folders', req.params.id, patch);
  auditService.log({ action: ACTIONS.FOLDER_UPDATE, userId: req.user.id, workspaceId: folder.workspaceId, resourceId: folder.id, details: patch, ip: req.ip });
  sendSuccess(res, { folder }, '更新成功');
});

exports.remove = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const folder = store.get('folders', id);
  if (!folder) throw new AppError('文件夹不存在', 404, 'NOT_FOUND');
  function collectFolders(fid) {
    const children = store.findAll('folders', f => f.parentId === fid);
    let result = [fid];
    for (const c of children) result = result.concat(collectFolders(c.id));
    return result;
  }
  const folderIds = collectFolders(id);
  const allNotes = store.findAll('notes', n => folderIds.includes(n.folderId));
  for (const n of allNotes) store.remove('notes', n.id);
  for (const fid of folderIds) store.remove('folders', fid);
  auditService.log({ action: ACTIONS.FOLDER_DELETE, userId: req.user.id, workspaceId: folder.workspaceId, resourceId: id, ip: req.ip });
  sendSuccess(res, null, '已删除');
});

exports.moveNote = asyncHandler(async (req, res) => {
  const { noteId, folderId } = req.body || {};
  const note = store.get('notes', noteId);
  if (!note) throw new AppError('笔记不存在', 404, 'NOT_FOUND');
  const oldFolderId = note.folderId;
  if (oldFolderId) {
    const old = store.get('folders', oldFolderId);
    if (old) store.update('folders', oldFolderId, { noteIds: (old.noteIds || []).filter(n => n !== noteId), updatedAt: now() });
  }
  if (folderId) {
    const newF = store.get('folders', folderId);
    if (newF) {
      const ids = new Set(newF.noteIds || []);
      ids.add(noteId);
      store.update('folders', folderId, { noteIds: [...ids], updatedAt: now() });
    }
  }
  store.update('notes', noteId, { folderId, updatedAt: now() });
  auditService.log({ action: ACTIONS.NOTE_MOVE, userId: req.user.id, workspaceId: note.workspaceId, resourceId: noteId, details: { from: oldFolderId, to: folderId }, ip: req.ip });
  sendSuccess(res, null, '移动成功');
});
