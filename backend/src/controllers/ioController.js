const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const { store } = require('../storage/jsonStore');
const config = require('../config');
const { generateId, now, asyncHandler, sendSuccess, AppError } = require('../utils/common');
const { searchService } = require('../services/search');
const { auditService, ACTIONS } = require('../services/audit');
const { notificationService } = require('../services/notification');

let mammoth;
try { mammoth = require('mammoth'); } catch (e) { mammoth = null; }
let puppeteer;
try { puppeteer = require('puppeteer'); } catch (e) { puppeteer = null; }

function blocksToMarkdown(note) {
  const lines = [`# ${note.title || '未命名笔记'}`, ''];
  if ((note.tags || []).length) lines.push(`**标签**：${note.tags.join(', ')}`, '');
  lines.push(`_创建于 ${note.createdAt}，最后更新 ${note.updatedAt}_`, '');
  if (Array.isArray(note.blocks)) {
    for (const b of note.blocks) {
      if (b.type === 'heading' || b.type === 'h1') lines.push(`# ${b.content || ''}`);
      else if (b.type === 'h2') lines.push(`## ${b.content || ''}`);
      else if (b.type === 'h3') lines.push(`### ${b.content || ''}`);
      else if (b.type === 'paragraph' || b.type === 'markdown') lines.push(b.content || '', '');
      else if (b.type === 'bulleted' || b.type === 'ul') lines.push(`- ${b.content || ''}`);
      else if (b.type === 'numbered' || b.type === 'ol') lines.push(`1. ${b.content || ''}`);
      else if (b.type === 'todo' || b.type === 'task') lines.push(`- [${b.checked ? 'x' : ' '}] ${b.content || ''}`);
      else if (b.type === 'quote') lines.push(`> ${b.content || ''}`);
      else if (b.type === 'code') lines.push('```' + (b.language || ''), b.content || '', '```');
      else if (b.type === 'divider') lines.push('---');
      else if (b.type === 'image') lines.push(`![${b.alt || ''}](${b.url || ''})`);
      else if (b.content) lines.push(b.content, '');
    }
  }
  return lines.join('\n');
}

exports.exportMarkdown = asyncHandler(async (req, res) => {
  const note = store.get('notes', req.params.id);
  if (!note) throw new AppError('笔记不存在', 404, 'NOT_FOUND');
  const md = blocksToMarkdown(note);
  auditService.log({ action: ACTIONS.NOTE_EXPORT, userId: req.user.id, workspaceId: note.workspaceId, resourceId: note.id, details: { format: 'md' }, ip: req.ip });
  const filename = encodeURIComponent((note.title || 'note') + '.md');
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(md);
});

exports.exportHtml = asyncHandler(async (req, res) => {
  const note = store.get('notes', req.params.id);
  if (!note) throw new AppError('笔记不存在', 404, 'NOT_FOUND');
  const md = blocksToMarkdown(note);
  const htmlBody = marked.parse(md, { breaks: true, gfm: true });
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${note.title || ''}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:860px;margin:40px auto;padding:0 20px;line-height:1.7;color:#222}h1,h2,h3{line-height:1.3}blockquote{border-left:4px solid #ddd;margin:1em 0;padding:0.5em 1em;color:#666}code{background:#f5f5f5;padding:2px 6px;border-radius:4px}pre{background:#f5f5f5;padding:16px;border-radius:8px;overflow-x:auto}pre code{background:transparent;padding:0}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px 12px;text-align:left}th{background:#f9f9f9}img{max-width:100%}</style>
</head><body>${htmlBody}</body></html>`;
  auditService.log({ action: ACTIONS.NOTE_EXPORT, userId: req.user.id, workspaceId: note.workspaceId, resourceId: note.id, details: { format: 'html' }, ip: req.ip });
  const filename = encodeURIComponent((note.title || 'note') + '.html');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(fullHtml);
});

exports.exportPdf = asyncHandler(async (req, res) => {
  const note = store.get('notes', req.params.id);
  if (!note) throw new AppError('笔记不存在', 404, 'NOT_FOUND');
  if (!puppeteer) {
    return sendSuccess(res, { format: 'pdf', status: 'skipped', reason: 'puppeteer 未安装，请使用 HTML/Markdown 导出' });
  }
  const md = blocksToMarkdown(note);
  const htmlBody = marked.parse(md, { breaks: true, gfm: true });
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${note.title || ''}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:860px;margin:40px auto;padding:0 20px;line-height:1.7;color:#222}h1,h2,h3{line-height:1.3}blockquote{border-left:4px solid #ddd;margin:1em 0;padding:0.5em 1em;color:#666}code{background:#f5f5f5;padding:2px 6px;border-radius:4px}pre{background:#f5f5f5;padding:16px;border-radius:8px;overflow-x:auto}pre code{background:transparent;padding:0}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px 12px;text-align:left}th{background:#f9f9f9}img{max-width:100%}</style>
</head><body>${htmlBody}</body></html>`;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();
  auditService.log({ action: ACTIONS.NOTE_EXPORT, userId: req.user.id, workspaceId: note.workspaceId, resourceId: note.id, details: { format: 'pdf' }, ip: req.ip });
  const filename = encodeURIComponent((note.title || 'note') + '.pdf');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(pdf);
});

function markdownToBlocks(md) {
  const lines = (md || '').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^#\s+/.test(line)) { blocks.push({ id: generateId('b_'), type: 'heading', content: line.replace(/^#\s+/, '') }); i++; }
    else if (/^##\s+/.test(line)) { blocks.push({ id: generateId('b_'), type: 'h2', content: line.replace(/^##\s+/, '') }); i++; }
    else if (/^###\s+/.test(line)) { blocks.push({ id: generateId('b_'), type: 'h3', content: line.replace(/^###\s+/, '') }); i++; }
    else if (/^-\s*\[[x\s]\]\s+/.test(line)) {
      const checked = /-\s*\[x\]\s+/.test(line);
      blocks.push({ id: generateId('b_'), type: 'todo', content: line.replace(/^-\s*\[[x\s]\]\s+/, ''), checked });
      i++;
    }
    else if (/^[-*]\s+/.test(line)) { blocks.push({ id: generateId('b_'), type: 'bulleted', content: line.replace(/^[-*]\s+/, '') }); i++; }
    else if (/^\d+\.\s+/.test(line)) { blocks.push({ id: generateId('b_'), type: 'numbered', content: line.replace(/^\d+\.\s+/, '') }); i++; }
    else if (/^>\s?/.test(line)) {
      const quotes = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { quotes.push(lines[i].replace(/^>\s?/, '')); i++; }
      blocks.push({ id: generateId('b_'), type: 'quote', content: quotes.join('\n') });
    }
    else if (/^```/.test(line)) {
      const lang = line.replace(/^```/, '').trim();
      i++;
      const code = [];
      while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i++; }
      i++;
      blocks.push({ id: generateId('b_'), type: 'code', language: lang, content: code.join('\n') });
    }
    else if (/^---+$/.test(line)) { blocks.push({ id: generateId('b_'), type: 'divider' }); i++; }
    else if (line.trim() === '') { i++; }
    else {
      const para = [];
      while (i < lines.length && lines[i].trim() !== '' && !/^#\s+/.test(lines[i]) && !/^##\s+/.test(lines[i]) && !/^###\s+/.test(lines[i]) && !/^[-*]\s+/.test(lines[i]) && !/^\d+\.\s+/.test(lines[i]) && !/^>\s?/.test(lines[i]) && !/^```/.test(lines[i]) && !/^---+$/.test(lines[i])) {
        para.push(lines[i]); i++;
      }
      blocks.push({ id: generateId('b_'), type: 'markdown', content: para.join('\n') });
    }
  }
  return blocks;
}

exports.importMarkdown = asyncHandler(async (req, res) => {
  const { workspaceId, folderId, title, content } = req.body || {};
  if (!workspaceId) throw new AppError('workspaceId 必填', 400, 'BAD_REQUEST');
  if (!content) throw new AppError('内容不能为空', 400, 'BAD_REQUEST');
  const blocks = markdownToBlocks(content);
  let noteTitle = title || '未命名导入笔记';
  const firstHeading = blocks.find(b => b.type === 'heading');
  if (!title && firstHeading) {
    noteTitle = firstHeading.content || noteTitle;
  }
  const id = generateId('n_');
  const note = {
    id, workspaceId, folderId: folderId || null,
    title: noteTitle, tags: [], blocks,
    ydocVersion: 0, createdBy: req.user.id, updatedBy: req.user.id,
    lastActiveAt: now(), versions: [], comments: 0,
    createdAt: now(), updatedAt: now(),
  };
  store.insert('notes', id, note);
  searchService.indexNote(note);
  if (folderId) {
    const f = store.get('folders', folderId);
    if (f) {
      const ids = new Set(f.noteIds || []);
      ids.add(id);
      store.update('folders', folderId, { noteIds: [...ids], updatedAt: now() });
    }
  }
  auditService.log({ action: ACTIONS.NOTE_IMPORT, userId: req.user.id, workspaceId, resourceId: id, details: { format: 'md' }, ip: req.ip });
  sendSuccess(res, { note }, '导入成功');
});

exports.importFile = asyncHandler(async (req, res) => {
  const { workspaceId, folderId } = req.body || {};
  if (!workspaceId) throw new AppError('workspaceId 必填', 400, 'BAD_REQUEST');
  const fileKeys = Object.keys(req.files || {});
  if (!fileKeys.length && !req.body.fileContent) throw new AppError('未上传文件', 400, 'BAD_REQUEST');
  let content = req.body.fileContent;
  let originalName = req.body.fileName || 'imported';
  let ext = 'md';
  if (fileKeys.length) {
    const f = req.files[fileKeys[0]];
    originalName = f.originalFilename || f.name || originalName;
    const filePath = f.path || f.filepath;
    ext = (path.extname(originalName) || '').toLowerCase().slice(1) || 'md';
    if (ext === 'docx') {
      if (!mammoth) throw new AppError('mammoth 未安装，无法导入 docx', 500, 'DEPENDENCY_MISSING');
      const result = await mammoth.convertToMarkdown({ path: filePath });
      content = result.value || '';
    } else {
      content = fs.readFileSync(filePath, 'utf8');
    }
    try { fs.unlinkSync(filePath); } catch (e) {}
  }
  const blocks = markdownToBlocks(content);
  let noteTitle = originalName.replace(/\.[^.]+$/, '') || '未命名导入笔记';
  const firstHeading = blocks.find(b => b.type === 'heading');
  if (firstHeading && noteTitle === '未命名导入笔记') noteTitle = firstHeading.content || noteTitle;
  const id = generateId('n_');
  const note = {
    id, workspaceId, folderId: folderId || null,
    title: noteTitle, tags: [], blocks,
    ydocVersion: 0, createdBy: req.user.id, updatedBy: req.user.id,
    lastActiveAt: now(), versions: [], comments: 0,
    createdAt: now(), updatedAt: now(),
  };
  store.insert('notes', id, note);
  searchService.indexNote(note);
  if (folderId) {
    const f = store.get('folders', folderId);
    if (f) {
      const ids = new Set(f.noteIds || []);
      ids.add(id);
      store.update('folders', folderId, { noteIds: [...ids], updatedAt: now() });
    }
  }
  auditService.log({ action: ACTIONS.NOTE_IMPORT, userId: req.user.id, workspaceId, resourceId: id, details: { format: ext }, ip: req.ip });
  sendSuccess(res, { note }, '导入成功');
});

exports.blocksToMarkdown = blocksToMarkdown;
exports.markdownToBlocks = markdownToBlocks;
