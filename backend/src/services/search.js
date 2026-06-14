const { store } = require('../storage/jsonStore');
const { generateId, now } = require('../utils/common');

let nodejieba;
try {
  nodejieba = require('nodejieba');
} catch (e) {
  nodejieba = null;
  console.warn('[Search] nodejieba not installed, fallback to char-based tokenization');
}

class BM25Search {
  constructor(k1 = 1.5, b = 0.75) {
    this.k1 = k1;
    this.b = b;
    this.docIndex = new Map();
    this.avgDocLen = 0;
    this._rebuild = false;
  }

  tokenize(text) {
    if (!text) return [];
    const lower = String(text).toLowerCase();
    if (nodejieba) {
      return nodejieba.cutForSearch(lower, true).filter(t => t.trim() && t.trim().length > 0);
    }
    const terms = [];
    let buffer = '';
    for (const ch of lower) {
      const code = ch.charCodeAt(0);
      if ((code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf)) {
        if (buffer) { terms.push(buffer); buffer = ''; }
        terms.push(ch);
      } else if (/[a-z0-9]/.test(ch)) {
        buffer += ch;
      } else {
        if (buffer) { terms.push(buffer); buffer = ''; }
      }
    }
    if (buffer) terms.push(buffer);
    return terms;
  }

  addDoc(id, fields) {
    const all = Object.values(fields).join(' ');
    const tokens = this.tokenize(all);
    const freq = new Map();
    for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
    const fieldFreqs = {};
    for (const [k, v] of Object.entries(fields)) {
      const ft = this.tokenize(v);
      const ff = new Map();
      for (const t of ft) ff.set(t, (ff.get(t) || 0) + 1);
      fieldFreqs[k] = ff;
    }
    this.docIndex.set(id, { id, fields, tokens, freq, fieldFreqs, length: tokens.length });
    this._rebuild = true;
  }

  removeDoc(id) {
    this.docIndex.delete(id);
    this._rebuild = true;
  }

  _computeStats() {
    if (!this._rebuild) return;
    const docs = [...this.docIndex.values()];
    const totalLen = docs.reduce((s, d) => s + d.length, 0);
    this.avgDocLen = docs.length ? totalLen / docs.length : 1;
    this.df = new Map();
    for (const d of docs) {
      for (const term of d.freq.keys()) {
        this.df.set(term, (this.df.get(term) || 0) + 1);
      }
    }
    this.nDocs = docs.length;
    this._rebuild = false;
  }

  scoreDoc(queryTerms, doc, fieldBoost = {}) {
    this._computeStats();
    const avgdl = this.avgDocLen || 1;
    let score = 0;
    const qf = new Map();
    for (const t of queryTerms) qf.set(t, (qf.get(t) || 0) + 1);
    for (const [qterm, qft] of qf) {
      for (const [fname, fmap] of Object.entries(doc.fieldFreqs)) {
        const f = fmap.get(qterm) || 0;
        if (!f) continue;
        const df = this.df.get(qterm) || 0;
        const idf = Math.log(1 + (this.nDocs - df + 0.5) / (df + 0.5));
        const boost = fieldBoost[fname] ?? 1;
        const denom = f + this.k1 * (1 - this.b + this.b * (doc.length / avgdl));
        const tf = (f * (this.k1 + 1)) / denom;
        score += idf * tf * boost;
      }
    }
    return score;
  }

  search(query, options = {}) {
    this._computeStats();
    const {
      fieldBoost = { title: 5, tags: 3, content: 1 },
      limit = 50, minScore = 0.01, workspaceId = null,
    } = options;
    const terms = this.tokenize(query);
    if (!terms.length) return [];
    const results = [];
    for (const doc of this.docIndex.values()) {
      if (workspaceId && doc.fields.workspaceId !== workspaceId) continue;
      const s = this.scoreDoc(terms, doc, fieldBoost);
      if (s > minScore) {
        const highlights = this._highlight(doc.fields, terms);
        results.push({ id: doc.id, score: s, fields: doc.fields, highlights });
      }
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  _highlight(fields, terms) {
    const result = {};
    const termSet = new Set(terms.map(t => t.toLowerCase()));
    for (const [k, v] of Object.entries(fields)) {
      if (typeof v !== 'string' && !Array.isArray(v)) continue;
      let text = typeof v === 'string' ? v : v.join(', ');
      const lower = text.toLowerCase();
      let matched = false;
      const spans = [];
      for (const t of termSet) {
        if (!t) continue;
        let idx = 0;
        while ((idx = lower.indexOf(t, idx)) !== -1) {
          spans.push([idx, idx + t.length]);
          idx += t.length;
          matched = true;
        }
      }
      if (matched) {
        spans.sort((a, b) => a[0] - b[0]);
        const merged = [];
        for (const s of spans) {
          if (merged.length && s[0] <= merged[merged.length - 1][1]) {
            merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], s[1]);
          } else merged.push([...s]);
        }
        let out = ''; let last = 0;
        for (const [s, e] of merged) {
          if (s > last) out += this._escapeHtml(text.slice(last, s));
          out += '<mark>' + this._escapeHtml(text.slice(s, e)) + '</mark>';
          last = e;
        }
        if (last < text.length) out += this._escapeHtml(text.slice(last));
        const windowSize = k === 'content' ? 160 : text.length;
        if (out.length > windowSize && merged.length) {
          const center = (merged[0][0] + merged[0][1]) / 2;
          const start = Math.max(0, Math.floor(center - windowSize / 2));
          const end = Math.min(out.length, start + windowSize);
          const prefix = start > 0 ? '…' : '';
          const suffix = end < out.length ? '…' : '';
          out = prefix + out.slice(start, end) + suffix;
        }
        result[k] = out;
      }
    }
    return result;
  }

  _escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

class SearchService {
  constructor() {
    this.engine = new BM25Search();
    this._loaded = false;
  }

  _ensureLoaded() {
    if (this._loaded) return;
    const notes = store.findAll('notes');
    for (const n of notes) this._indexNote(n);
    this._loaded = true;
    console.log(`[Search] Indexed ${notes.length} notes`);
  }

  _noteText(n) {
    let content = '';
    if (Array.isArray(n.blocks)) {
      for (const b of n.blocks) {
        if (typeof b.content === 'string') content += b.content + ' ';
        else if (b.text) content += b.text + ' ';
      }
    }
    return { title: n.title || '', tags: (n.tags || []).join(' '), content, workspaceId: n.workspaceId };
  }

  _indexNote(n) {
    const f = this._noteText(n);
    this.engine.addDoc(n.id, { ...f, workspaceId: n.workspaceId, folderId: n.folderId, id: n.id, updatedAt: n.updatedAt });
  }

  indexNote(n) {
    this._ensureLoaded();
    this._indexNote(n);
  }

  removeNote(id) {
    this._ensureLoaded();
    this.engine.removeDoc(id);
  }

  searchNotes(query, { workspaceId, limit = 50, offset = 0 } = {}) {
    this._ensureLoaded();
    const raw = this.engine.search(query, { workspaceId, limit: 500 });
    const enriched = raw.slice(offset, offset + limit).map(r => {
      const note = store.get('notes', r.id);
      return {
        id: r.id,
        title: note?.title || r.fields.title,
        tags: note?.tags || [],
        updatedAt: note?.updatedAt,
        updatedBy: note?.updatedBy,
        workspaceId: r.fields.workspaceId,
        folderId: r.fields.folderId,
        score: r.score,
        highlights: r.highlights,
      };
    });
    const noteIds = [...new Set(enriched.map(e => e.updatedBy).filter(Boolean))];
    const users = Object.fromEntries(
      store.findAll('users', u => noteIds.includes(u.id)).map(u => [u.id, { id: u.id, name: u.name, username: u.username }])
    );
    return { total: raw.length, items: enriched, users };
  }

  recordHistory(userId, workspaceId, query) {
    if (!query || query.trim().length < 1) return;
    const id = generateId('sh_');
    const existing = store.findOne('searchHistory', h => h.userId === userId && h.workspaceId === workspaceId && h.query === query);
    if (existing) {
      store.update('searchHistory', existing.id, { count: (existing.count || 1) + 1, createdAt: now() });
      return existing;
    }
    const record = { id, userId, workspaceId, query: query.trim(), count: 1, createdAt: now() };
    store.insert('searchHistory', id, record);
    const all = store.findAll('searchHistory', h => h.userId === userId && h.workspaceId === workspaceId);
    all.sort((a, b) => (b.count || 0) - (a.count || 0) || new Date(b.createdAt) - new Date(a.createdAt));
    const maxHistory = 100;
    for (let i = maxHistory; i < all.length; i++) store.remove('searchHistory', all[i].id);
    return record;
  }

  getHistory(userId, workspaceId, limit = 20) {
    const list = store.findAll('searchHistory', h => h.userId === userId && h.workspaceId === workspaceId);
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return list.slice(0, limit);
  }

  clearHistory(userId, workspaceId) {
    const list = store.findAll('searchHistory', h => h.userId === userId && h.workspaceId === workspaceId);
    for (const h of list) store.remove('searchHistory', h.id);
    return list.length;
  }

  getHotTerms(workspaceId, limit = 20) {
    const list = store.findAll('searchHistory', h => h.workspaceId === workspaceId);
    const agg = new Map();
    for (const h of list) agg.set(h.query, (agg.get(h.query) || 0) + (h.count || 1));
    return [...agg.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([term, count]) => ({ term, count }));
  }
}

const searchService = new SearchService();

module.exports = { searchService, BM25Search };
