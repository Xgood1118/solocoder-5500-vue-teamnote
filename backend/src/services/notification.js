const { store } = require('./jsonStore');
const { generateId, now } = require('../utils/common');
const EventEmitter = require('events');

class NotificationService extends EventEmitter {
  create({ userId, type, title, content, relatedId, relatedType, metadata = {}, fromUserId = null }) {
    const id = generateId('notif_');
    const record = { id, userId, type, title, content, relatedId, relatedType, metadata, fromUserId, read: false, createdAt: now() };
    store.insert('notifications', id, record);
    this.emit('notify', userId, record);
    return record;
  }

  markRead(userId, id) {
    const n = store.get('notifications', id);
    if (n && n.userId === userId) return store.update('notifications', id, { read: true, readAt: now() });
    return null;
  }

  markAllRead(userId) {
    const unread = store.findAll('notifications', n => n.userId === userId && !n.read);
    for (const n of unread) store.update('notifications', n.id, { read: true, readAt: now() });
    return unread.length;
  }

  listByUser(userId, { limit = 50, offset = 0, unreadOnly = false } = {}) {
    let list = store.findAll('notifications', n => n.userId === userId);
    if (unreadOnly) list = list.filter(n => !n.read);
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return { total: list.length, items: list.slice(offset, offset + limit) };
  }

  unreadCount(userId) {
    return store.count('notifications', n => n.userId === userId && !n.read);
  }

  notifyMentions(workspace, note, content, commentId, fromUserId) {
    const mentions = parseMentions(content);
    const allUsers = store.findAll('users', u => u.workspaceIds?.includes(workspace.id));
    const userMap = Object.fromEntries(allUsers.map(u => [u.username, u]));

    const toNotify = new Set();
    for (const m of mentions.users) if (userMap[m]) toNotify.add(userMap[m].id);
    if (mentions.everyone) for (const u of allUsers) toNotify.add(u.id);
    for (const role of mentions.roles) {
      const field = role === 'owner' ? 'ownerId' : `${role}s`;
      if (role === 'owner') { toNotify.add(workspace.ownerId); continue; }
      const list = workspace[field] || [];
      for (const id of list) toNotify.add(id);
    }
    toNotify.delete(fromUserId);

    for (const uid of toNotify) {
      this.create({
        userId: uid, type: 'mention',
        title: `${store.get('users', fromUserId)?.name || '有人'} 在评论中 @ 了你`,
        content, fromUserId,
        relatedId: note.id, relatedType: 'note',
        metadata: { workspaceId: workspace.id, commentId },
      });
    }
  }

  notifyNoteShared(workspaceId, note, sharedUserId, fromUserId, permission) {
    this.create({
      userId: sharedUserId, type: 'share',
      title: `${store.get('users', fromUserId)?.name || '有人'} 分享了一篇笔记给你`,
      content: `《${note.title}》 (${permission}权限)`,
      fromUserId, relatedId: note.id, relatedType: 'note',
      metadata: { workspaceId, permission },
    });
  }

  notifyInviteAccepted(inviteLinkId, inviterId, newUserName) {
    this.create({
      userId: inviterId, type: 'invite',
      title: '邀请链接已被使用',
      content: `${newUserName} 通过你的邀请链接加入了工作空间`,
      metadata: { inviteLinkId },
    });
  }
}

function parseMentions(text) {
  const result = { users: [], roles: [], everyone: false };
  if (!text) return result;
  const regex = /@(\S+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const tag = match[1].replace(/[:：,.!?，。！？]$/, '');
    if (tag === '所有人' || tag === 'all' || tag === 'everyone') result.everyone = true;
    else if (tag === '管理员' || tag === 'admin') result.roles.push('admin');
    else if (tag === '编辑者' || tag === 'editor') result.roles.push('editor');
    else if (tag === '浏览者' || tag === 'viewer') result.roles.push('viewer');
    else if (tag === '访客' || tag === 'guest') result.roles.push('guest');
    else if (tag === '所有者' || tag === 'owner') result.roles.push('owner');
    else result.users.push(tag);
  }
  return result;
}

const notificationService = new NotificationService();

module.exports = { notificationService, parseMentions };
