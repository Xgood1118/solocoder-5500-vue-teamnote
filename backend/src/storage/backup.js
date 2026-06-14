const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const config = require('../config');
const { store, COLLECTIONS } = require('./jsonStore');

class BackupManager {
  constructor() {
    this.backupDir = config.backupDir;
    this.maxBackups = config.maxBackups;
  }

  createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `backup-${timestamp}`);
    fs.mkdirSync(backupPath, { recursive: true });

    for (const name of Object.keys(COLLECTIONS)) {
      const src = path.join(config.dataDir, COLLECTIONS[name]);
      const dest = path.join(backupPath, COLLECTIONS[name]);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
      }
    }

    const meta = {
      timestamp,
      collections: Object.keys(COLLECTIONS),
      counts: {},
    };
    for (const name of Object.keys(COLLECTIONS)) {
      meta.counts[name] = store.count(name);
    }
    fs.writeFileSync(path.join(backupPath, 'meta.json'), JSON.stringify(meta, null, 2));
    this._cleanupOldBackups();
    console.log(`[Backup] Created backup: ${backupPath}`);
    return backupPath;
  }

  _cleanupOldBackups() {
    const backups = fs.readdirSync(this.backupDir)
      .filter(d => d.startsWith('backup-'))
      .sort()
      .reverse();
    while (backups.length > this.maxBackups) {
      const old = backups.pop();
      const oldPath = path.join(this.backupDir, old);
      this._removeDir(oldPath);
      console.log(`[Backup] Removed old backup: ${old}`);
    }
  }

  _removeDir(dir) {
    if (!fs.existsSync(dir)) return;
    for (const file of fs.readdirSync(dir)) {
      const p = path.join(dir, file);
      if (fs.statSync(p).isDirectory()) this._removeDir(p);
      else fs.unlinkSync(p);
    }
    fs.rmdirSync(dir);
  }

  listBackups() {
    if (!fs.existsSync(this.backupDir)) return [];
    return fs.readdirSync(this.backupDir)
      .filter(d => d.startsWith('backup-'))
      .sort()
      .reverse()
      .map(d => {
        const metaPath = path.join(this.backupDir, d, 'meta.json');
        let meta = null;
        try {
          if (fs.existsSync(metaPath)) meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        } catch (e) {}
        return { name: d, path: path.join(this.backupDir, d), meta };
      });
  }

  restore(backupName) {
    const backupPath = path.join(this.backupDir, backupName);
    if (!fs.existsSync(backupPath)) throw new Error('Backup not found');

    for (const name of Object.keys(COLLECTIONS)) {
      const src = path.join(backupPath, COLLECTIONS[name]);
      const dest = path.join(config.dataDir, COLLECTIONS[name]);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
      }
    }
    console.log(`[Backup] Restored from: ${backupName}`);
  }

  startScheduler() {
    const minutes = config.backupIntervalMinutes;
    const expr = `0 */${Math.min(59, minutes)} * * * *`;
    cron.schedule(expr, () => {
      try { this.createBackup(); }
      catch (e) { console.error('[Backup] Scheduled backup failed:', e); }
    });
    console.log(`[Backup] Scheduler started: every ${minutes} minutes`);
  }
}

const backupManager = new BackupManager();

module.exports = { backupManager };
