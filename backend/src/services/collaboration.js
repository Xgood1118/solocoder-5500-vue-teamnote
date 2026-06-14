const http = require('http');
const WebSocket = require('ws');
const Y = require('yjs');
const syncProtocol = require('y-protocols/sync');
const awarenessProtocol = require('y-protocols/awareness');
const { store } = require('../storage/jsonStore');
const { searchService } = require('../services/search');
const { verifyToken } = require('../utils/auth');
const { now } = require('../utils/common');
const { getWorkspaceRole, hasPermission, PERMISSIONS } = require('../middleware/permissions');
const config = require('../config');
const EventEmitter = require('events');

const encoding = require('lib0/encoding');
const decoding = require('lib0/decoding');
const map = require('lib0/map');

const wsReadyStateConnecting = 0;
const wsReadyStateOpen = 1;
const wsReadyStateClosing = 2;
const wsReadyStateClosed = 3;

const messageSync = 0;
const messageAwareness = 1;
const messageCustom = 2;

const gcEnabled = true;

class CollaborationServer extends EventEmitter {
  constructor() {
    super();
    this.docs = new Map();
    this.historySnapshots = new Map();
  }

  setupYDoc(noteId, wsDoc) {
    wsDoc.gc = gcEnabled;
    wsDoc.on('update', (update, origin, doc, tr) => {
      this._onDocUpdate(noteId, update, origin, doc);
    });
    wsDoc.on('beforeAllTransactions', () => {});
    wsDoc.on('afterAllTransactions', () => {});
    wsDoc.awareness = new awarenessProtocol.Awareness(wsDoc);
    wsDoc.awareness.setLocalState(null);
    wsDoc.awareness.on('update', ({ added, updated, removed }, origin) => {
      const changed = added.concat(updated, removed);
      const conn = wsDoc.conns;
      if (origin === null) return;
      const buff = encoding.createEncoder();
      encoding.writeVarUint(buff, messageAwareness);
      encoding.writeVarUint8Array(buff, awarenessProtocol.encodeAwarenessUpdate(wsDoc.awareness, changed));
      const data = encoding.toUint8Array(buff);
      wsDoc.conns.forEach((_, c) => {
        if (origin !== c && c.readyState <= 1) {
          this._send(c, data);
        }
      });
    });
    wsDoc.conns = new Map();
  }

  _onDocUpdate(noteId, update, origin, doc) {
    const docData = this.docs.get(noteId);
    if (!docData) return;
    const wsDoc = docData.doc;
    const note = store.get('notes', noteId);
    if (!note) return;
    docData.lastUpdate = Date.now();
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeUpdate(encoder, update);
    const data = encoding.toUint8Array(encoder);
    wsDoc.conns.forEach((_, conn) => {
      if (origin !== conn && (conn.readyState === wsReadyStateConnecting || conn.readyState === wsReadyStateOpen)) {
        this._send(conn, data);
      }
    });
    if (!docData.history || !docData.history.updates) docData.history = { updates: [] };
    docData.history.updates.push({ t: Date.now(), u: Buffer.from(update).toString('base64'), o: origin?.userId || null });
    if (docData.history.updates.length > 5000) {
      const stateVec = Y.encodeStateVector(wsDoc);
      docData.history.base64State = Buffer.from(Y.encodeStateAsUpdate(wsDoc)).toString('base64');
      docData.history.updates = [];
    }
    const throttled = docData.saveTimer;
    clearTimeout(throttled);
    docData.saveTimer = setTimeout(() => {
      try {
        const ydocState = Buffer.from(Y.encodeStateAsUpdate(wsDoc)).toString('base64');
        const titleMap = wsDoc.getMap('meta').get('title');
        if (titleMap && titleMap !== note.title) {
          store.update('notes', noteId, { title: titleMap, updatedAt: now() });
        }
        const blocksArr = wsDoc.getMap('meta').get('blocks');
        const patch = { ydocState, ydocVersion: (note.ydocVersion || 0) + 1, updatedAt: now() };
        if (Array.isArray(blocksArr)) patch.blocks = blocksArr;
        store.update('notes', noteId, patch);
        const updated = store.get('notes', noteId);
        searchService.indexNote(updated);
      } catch (e) {
        console.error('[Collab] Persist ydoc failed:', e);
      }
    }, 2000);
  }

  _send(conn, m) {
    if (conn.readyState !== wsReadyStateConnecting && conn.readyState !== wsReadyStateOpen) {
      try { this._closeConn(conn, null); } catch (e) {}
      return;
    }
    try { conn.send(m); } catch (e) { this._closeConn(conn, e); }
  }

  _closeConn(conn, reason) {
    if (conn._closed) return;
    conn._closed = true;
    const docData = conn._docData;
    if (!docData) return;
    const { noteId, userId, doc: wsDoc, userMeta } = docData;
    try {
      wsDoc.conns.delete(conn);
    } catch (e) {}
    try {
      const userStates = [...wsDoc.awareness.getStates().keys()];
      if (conn._clientId !== undefined && userStates.includes(conn._clientId)) {
        awarenessProtocol.removeAwarenessStates(wsDoc.awareness, [conn._clientId], 'conn close');
      }
    } catch (e) {}
    if (wsDoc.conns.size === 0) {
      try {
        const ydocState = Buffer.from(Y.encodeStateAsUpdate(wsDoc)).toString('base64');
        const note = store.get('notes', noteId);
        if (note) store.update('notes', noteId, { ydocState, updatedAt: now() });
      } catch (e) {}
      setTimeout(() => {
        const d = this.docs.get(noteId);
        if (d && d.doc.conns.size === 0) {
          this.docs.delete(noteId);
          console.log(`[Collab] Unload doc ${noteId}`);
        }
      }, 1000 * 60 * 5);
    }
    try { conn.close(); } catch (e) {}
  }

  getOrCreateDoc(noteId, userId) {
    if (this.docs.has(noteId)) return this.docs.get(noteId);
    const doc = new Y.Doc();
    this.setupYDoc(noteId, doc);
    const note = store.get('notes', noteId);
    if (note) {
      if (note.ydocState) {
        try {
          Y.applyUpdate(doc, Buffer.from(note.ydocState, 'base64'));
        } catch (e) { console.warn('[Collab] Could not restore ydoc state:', e.message); }
      }
      if (!doc.getMap('meta').get('title')) {
        doc.getMap('meta').set('title', note.title || '');
      }
      if (!doc.getMap('meta').get('blocks') && Array.isArray(note.blocks)) {
        doc.getMap('meta').set('blocks', note.blocks);
      }
      if (!doc.getMap('meta').get('tags') && Array.isArray(note.tags)) {
        doc.getMap('meta').set('tags', note.tags);
      }
    }
    const data = {
      doc, noteId,
      createdAt: Date.now(),
      history: { updates: [], base64State: note?.ydocState || null },
      lastUpdate: Date.now(),
    };
    this.docs.set(noteId, data);
    console.log(`[Collab] Loaded doc ${noteId}`);
    return data;
  }

  replayHistory(noteId, onEvent) {
    const docData = this.docs.get(noteId);
    if (!docData) return null;
    const tempDoc = new Y.Doc();
    if (docData.history.base64State) {
      try { Y.applyUpdate(tempDoc, Buffer.from(docData.history.base64State, 'base64')); } catch (e) {}
    }
    const events = [];
    for (const up of docData.history.updates) {
      try {
        const changes = [];
        tempDoc.once('afterAllTransactions', (ds, tr) => {
          for (const op of tr.ops || []) {
            changes.push({ type: op.type, key: op.key, length: op.length });
          }
        });
        Y.applyUpdate(tempDoc, Buffer.from(up.u, 'base64'));
        events.push({ t: up.t, by: up.o, changes });
        if (onEvent) onEvent({ t: up.t, by: up.o, state: Y.encodeStateVector(tempDoc) });
      } catch (e) {}
    }
    return { totalEvents: events.length, baseEvents: events.slice(0, 500) };
  }

  authenticateAndConnect(socket, req) {
    const url = new URL(req.url, 'http://localhost');
    const noteId = url.searchParams.get('noteId');
    const token = url.searchParams.get('token') || (req.headers.authorization || '').replace(/^Bearer\s/, '');
    if (!noteId) { this._closeConn(socket, 'missing noteId'); return; }
    const payload = verifyToken(token);
    if (!payload) { this._closeConn(socket, 'auth failed'); return; }
    const userId = payload.userId;
    const note = store.get('notes', noteId);
    if (!note) { this._closeConn(socket, 'note not found'); return; }
    const ws = store.get('workspaces', note.workspaceId);
    if (!ws) { this._closeConn(socket, 'workspace not found'); return; }
    const role = getWorkspaceRole(userId, ws);
    if (!role) { this._closeConn(socket, 'no permission'); return; }
    if (!hasPermission(role, PERMISSIONS.NOTE_VIEW)) { this._closeConn(socket, 'no permission'); return; }
    const canWrite = hasPermission(role, PERMISSIONS.NOTE_EDIT);
    const user = store.get('users', userId) || {};
    const docData = this.getOrCreateDoc(noteId, userId);
    const { doc: wsDoc } = docData;
    wsDoc.conns.set(socket, { canWrite });
    socket._docData = docData;
    socket.userId = userId;
    socket.canWrite = canWrite;
    socket.userMeta = { id: userId, name: user.name || user.username, avatar: user.avatar || '', role, canWrite };

    socket.binaryType = 'arraybuffer';

    socket.on('message', m => {
      try {
        const data = m instanceof Buffer ? m : Buffer.from(m);
        const decoder = decoding.createDecoder(new Uint8Array(data));
        const encoder = encoding.createEncoder();
        const messageType = decoding.readVarUint(decoder);
        if (messageType === messageSync) {
          encoding.writeVarUint(encoder, messageSync);
          const preventWrite = !socket.canWrite;
          syncProtocol.readSyncMessage(decoder, encoder, wsDoc, preventWrite ? null : socket);
          if (encoding.length(encoder) > 1) this._send(socket, encoding.toUint8Array(encoder));
          if (wsDoc.conns.get(socket) === undefined) return;
        } else if (messageType === messageAwareness) {
          if (!socket.canWrite) return;
          const up = decoding.readVarUint8Array(decoder);
          try {
            const update = awarenessProtocol.applyAwarenessUpdate(wsDoc.awareness, up, socket);
            for (const cid of update.added.concat(update.updated)) {
              const state = wsDoc.awareness.getStates().get(cid);
              if (state && state.user) {
                state.user = Object.assign({}, state.user, socket.userMeta);
              }
            }
          } catch (e) {}
          const buff = encoding.createEncoder();
          encoding.writeVarUint(buff, messageAwareness);
          encoding.writeVarUint8Array(buff, awarenessProtocol.encodeAwarenessUpdate(wsDoc.awareness, [...wsDoc.awareness.getStates().keys()]));
          const msg = encoding.toUint8Array(buff);
          wsDoc.conns.forEach((_, conn) => {
            if (conn !== socket && (conn.readyState === wsReadyStateConnecting || conn.readyState === wsReadyStateOpen)) {
              this._send(conn, msg);
            }
          });
        } else if (messageType === messageCustom) {
          try {
            const subType = decoding.readVarUint(decoder);
            const raw = JSON.parse(decoding.readVarString(decoder));
            this._handleCustomMessage(socket, noteId, subType, raw);
          } catch (e) { console.warn('[Collab] Custom msg error', e.message); }
        }
      } catch (e) {
        console.error('[Collab] Message handling error:', e);
      }
    });

    socket.on('close', () => this._closeConn(socket, null));
    socket.on('error', (e) => this._closeConn(socket, e));

    const init = encoding.createEncoder();
    encoding.writeVarUint(init, messageSync);
    syncProtocol.writeSyncStep1(init, wsDoc);
    this._send(socket, encoding.toUint8Array(init));

    const aw = encoding.createEncoder();
    encoding.writeVarUint(aw, messageAwareness);
    encoding.writeVarUint8Array(aw, awarenessProtocol.encodeAwarenessUpdate(wsDoc.awareness, [...wsDoc.awareness.getStates().keys()]));
    this._send(socket, encoding.toUint8Array(aw));

    store.update('notes', noteId, { lastActiveAt: now() });
  }

  _handleCustomMessage(socket, noteId, subType, payload) {
    const docData = this.docs.get(noteId);
    if (!docData) return;
    switch (subType) {
      case 1: {
        const result = this.replayHistory(noteId);
        this._sendCustom(socket, 1, { total: result?.totalEvents || 0, events: result?.baseEvents || [] });
        break;
      }
      case 2: {
        const { versionId } = payload || {};
        const v = store.get('noteVersions', versionId);
        if (v && v.noteId === noteId) {
          this._sendCustom(socket, 2, { ok: true, version: v });
        } else {
          this._sendCustom(socket, 2, { ok: false, error: 'not found' });
        }
        break;
      }
      default:
        break;
    }
  }

  _sendCustom(conn, subType, payload) {
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, messageCustom);
    encoding.writeVarUint(enc, subType);
    encoding.writeVarString(enc, JSON.stringify(payload));
    this._send(conn, encoding.toUint8Array(enc));
  }

  start(server) {
    const wss = new WebSocket.Server({ noServer: true });
    this.wss = wss;
    server.on('upgrade', (request, socket, head) => {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      if (pathname === '/ws/collab') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
    });
    wss.on('connection', (socket, req) => this.authenticateAndConnect(socket, req));
    console.log(`[Collab] WebSocket server listening on shared HTTP server at /ws/collab`);
  }

  startStandalone() {
    const server = http.createServer();
    const wss = new WebSocket.Server({ server });
    this.wss = wss;
    wss.on('connection', (socket, req) => this.authenticateAndConnect(socket, req));
    server.listen(config.wsPort, () => {
      console.log(`[Collab] WebSocket server listening on port ${config.wsPort}`);
    });
    return server;
  }
}

const collabServer = new CollaborationServer();

module.exports = { collabServer };
