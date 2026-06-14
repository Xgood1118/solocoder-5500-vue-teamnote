const { store } = require('./jsonStore');
const { generateId, now } = require('../utils/common');
const { hashPassword } = require('../utils/auth');

function seedIfEmpty() {
  if (store.count('users') === 0) {
    console.log('[Seed] Initializing sample data...');
    const ownerId = generateId('u_');
    const adminId = generateId('u_');
    const editorId = generateId('u_');
    const viewerId = generateId('u_');
    const guestId = generateId('u_');

    const users = [
      { id: ownerId, username: 'owner', password: hashPassword('123456'), name: 'Owner', email: 'owner@teamnote.dev', avatar: '', role: 'owner', workspaceIds: [], createdAt: now(), updatedAt: now() },
      { id: adminId, username: 'admin', password: hashPassword('123456'), name: 'Admin', email: 'admin@teamnote.dev', avatar: '', role: 'admin', workspaceIds: [], createdAt: now(), updatedAt: now() },
      { id: editorId, username: 'editor', password: hashPassword('123456'), name: 'Editor', email: 'editor@teamnote.dev', avatar: '', role: 'editor', workspaceIds: [], createdAt: now(), updatedAt: now() },
      { id: viewerId, username: 'viewer', password: hashPassword('123456'), name: 'Viewer', email: 'viewer@teamnote.dev', avatar: '', role: 'viewer', workspaceIds: [], createdAt: now(), updatedAt: now() },
      { id: guestId, username: 'guest', password: hashPassword('123456'), name: 'Guest', email: 'guest@teamnote.dev', avatar: '', role: 'guest', workspaceIds: [], createdAt: now(), updatedAt: now() },
    ];
    store.bulkInsert('users', users);

    const wsId = generateId('ws_');
    const workspace = {
      id: wsId,
      name: '产品团队工作空间',
      description: '产品研发团队共用的协作文档空间',
      icon: '📁',
      ownerId,
      admins: [adminId],
      editors: [editorId],
      viewers: [viewerId],
      guests: [guestId],
      createdAt: now(),
      updatedAt: now(),
    };
    store.insert('workspaces', wsId, workspace);

    for (const u of users) {
      u.workspaceIds = [wsId];
      store.update('users', u.id, { workspaceIds: [wsId] });
    }

    const folder1 = generateId('f_');
    const folder2 = generateId('f_');
    store.insert('folders', folder1, { id: folder1, workspaceId: wsId, parentId: null, name: '产品需求', icon: '📝', noteIds: [], order: 0, createdAt: now(), updatedAt: now() });
    store.insert('folders', folder2, { id: folder2, workspaceId: wsId, parentId: null, name: '研发文档', icon: '💻', noteIds: [], order: 1, createdAt: now(), updatedAt: now() });

    const note1 = generateId('n_');
    const note2 = generateId('n_');
    const note1Record = {
      id: note1, workspaceId: wsId, folderId: folder1, title: 'Q3 产品路线图',
      tags: ['规划', 'Q3'], blocks: [], ydocVersion: 0, createdBy: ownerId,
      updatedBy: ownerId, lastActiveAt: now(), versions: [], comments: 0,
      createdAt: now(), updatedAt: now(),
    };
    const note2Record = {
      id: note2, workspaceId: wsId, folderId: folder2, title: '技术架构说明',
      tags: ['架构'], blocks: [], ydocVersion: 0, createdBy: adminId,
      updatedBy: adminId, lastActiveAt: now(), versions: [], comments: 0,
      createdAt: now(), updatedAt: now(),
    };
    store.insert('notes', note1, note1Record);
    store.insert('notes', note2, note2Record);

    store.update('folders', folder1, { noteIds: [note1] });
    store.update('folders', folder2, { noteIds: [note2] });

    const templates = [
      { id: generateId('tpl_'), name: '周报模板', icon: '📊', category: '定期报告', content: '# 周报\n\n## 本周完成\n- \n\n## 下周计划\n- \n\n## 风险与问题\n- ', isSystem: true, createdAt: now() },
      { id: generateId('tpl_'), name: '月报模板', icon: '📈', category: '定期报告', content: '# 月报\n\n## 月度目标回顾\n- \n\n## 关键成果\n- \n\n## 下月计划\n- ', isSystem: true, createdAt: now() },
      { id: generateId('tpl_'), name: '会议纪要', icon: '📝', category: '会议', content: '# 会议纪要\n\n**日期**：\n**参会人**：\n\n## 议题\n1. \n\n## 决议\n- \n\n## 待办\n- [ ] ', isSystem: true, createdAt: now() },
      { id: generateId('tpl_'), name: '产品需求文档', icon: '📄', category: '产品', content: '# 产品需求文档\n\n## 背景\n\n## 目标\n\n## 用户故事\n- \n\n## 功能规格\n\n## 非功能需求', isSystem: true, createdAt: now() },
      { id: generateId('tpl_'), name: '技术方案', icon: '⚙️', category: '技术', content: '# 技术方案\n\n## 问题背景\n\n## 方案对比\n\n## 最终方案\n\n## 实施计划\n\n## 风险评估', isSystem: true, createdAt: now() },
    ];
    store.bulkInsert('templates', templates);

    const tags = ['规划', 'Q3', '架构', '紧急', '已完成', '进行中', '待评审', 'Bug'];
    for (let i = 0; i < tags.length; i++) {
      const id = generateId('tag_');
      store.insert('tags', id, { id, name: tags[i], color: `hsl(${i * 45}, 70%, 60%)`, usageCount: 1, createdAt: now() });
    }

    console.log('[Seed] Sample data created: 5 users / 1 workspace / 2 folders / 2 notes / 5 templates');
    console.log('[Seed] Accounts: owner/admin/editor/viewer/guest (password: 123456)');
  }
}

module.exports = { seedIfEmpty };
