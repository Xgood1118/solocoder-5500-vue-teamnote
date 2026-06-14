const fs = require('fs');
const path = require('path');
const config = require('../config');

const COLLECTIONS = {
  users: 'users.json',
  workspaces: 'workspaces.json',
  folders: 'folders.json',
  notes: 'notes.json',
  noteVersions: 'noteVersions.json',
  comments: 'comments.json',
  permissions: 'permissions.json',
  notifications: 'notifications.json',
  auditLogs: 'auditLogs.json',
  searchHistory: 'searchHistory.json',
  tags: 'tags.json',
  templates: 'templates.json',
  inviteLinks: 'inviteLinks.json',
  ydocs: 'ydocs.json',
};

class JsonStore {
  constructor() {
    this.dataDir = config.dataDir;
    this.cache = {};
    this.writeQueue = {};
    this._ensureDirs();
    this._initCollections();
  }

  _ensureDirs() {
    if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
    if (!fs.existsSync(config.backupDir)) fs.mkdirSync(config.backupDir, { recursive: true });
    if (!fs.existsSync(config.uploadDir)) fs.mkdirSync(config.uploadDir, { recursive: true });
  }

  _initCollections() {
    for (const name of Object.keys(COLLECTIONS)) {
      const file = path.join(this.dataDir, COLLECTIONS[name]);
      if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify({ data: {}, index: {} }, null, 2));
      }
      this.cache[name] = this._readFile(name);
    }
  }

  _readFile(name) {
    const file = path.join(this.dataDir, COLLECTIONS[name]);
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      return { data: {}, index: {} };
    }
  }

  _writeFile(name) {
    if (this.writeQueue[name]) return;
    this.writeQueue[name] = true;
    setImmediate(() => {
      try {
        const file = path.join(this.dataDir, COLLECTIONS[name]);
        const tmp = file + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(this.cache[name], null, 2));
        fs.renameSync(tmp, file);
      } catch (e) {
        console.error(`[Store] Write ${name} error:`, e);
      } finally {
        this.writeQueue[name] = false;
      }
    });
  }

  insert(name, id, record) {
    if (!this.cache[name]) this.cache[name] = { data: {}, index: {} };
    this.cache[name].data[id] = record;
    this._writeFile(name);
    return record;
  }

  update(name, id, patch) {
    if (!this.cache[name]?.data[id]) return null;
    this.cache[name].data[id] = { ...this.cache[name].data[id], ...patch };
    this._writeFile(name);
    return this.cache[name].data[id];
  }

  get(name, id) {
    return this.cache[name]?.data[id] || null;
  }

  remove(name, id) {
    if (!this.cache[name]?.data[id]) return false;
    delete this.cache[name].data[id];
    this._writeFile(name);
    return true;
  }

  findAll(name, filter = null) {
    const data = this.cache[name]?.data || {};
    const list = Object.values(data);
    if (!filter) return list;
    return list.filter(filter);
  }

  findOne(name, filter) {
    const data = this.cache[name]?.data || {};
    return Object.values(data).find(filter) || null;
  }

  count(name, filter = null) {
    return this.findAll(name, filter).length;
  }

  bulkInsert(name, records) {
    if (!this.cache[name]) this.cache[name] = { data: {}, index: {} };
    for (const r of records) this.cache[name].data[r.id] = r;
    this._writeFile(name);
  }

  getAllRaw(name) {
    return this.cache[name] || { data: {}, index: {} };
  }
}

const store = new JsonStore();

module.exports = { store, COLLECTIONS };
