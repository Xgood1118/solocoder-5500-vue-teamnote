import { defineStore } from 'pinia';
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { getToken } from '@/api/http';

const messageSync = 0;
const messageAwareness = 1;
const messageCustom = 2;

export const useCollabStore = defineStore('collab', {
  state: () => ({
    rooms: new Map(),
  }),
  actions: {
    connectRoom(noteId, opts = {}) {
      if (this.rooms.has(noteId)) return this.rooms.get(noteId);
      const room = this._createRoom(noteId, opts);
      this.rooms.set(noteId, room);
      return room;
    },
    disconnectRoom(noteId) {
      const room = this.rooms.get(noteId);
      if (room) {
        try { room.socket.close(); } catch (e) {}
        this.rooms.delete(noteId);
      }
    },
    getRoom(noteId) { return this.rooms.get(noteId); },
    _createRoom(noteId, { user = {}, onAwareness = null, onStatus = null, onCustom = null }) {
      const ydoc = new Y.Doc();
      const awareness = new awarenessProtocol.Awareness(ydoc);
      const token = getToken();
      const proto = location.protocol.startsWith('https') ? 'wss' : 'ws';
      const wsUrl = `${proto}://${location.host}/ws/collab?noteId=${noteId}&token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';

      const room = {
        ydoc, awareness, ws,
        status: 'connecting',
        cursors: new Map(),
        destroy: () => this.disconnectRoom(noteId),
        sendCustom(subType, payload) {
          const enc = encoding.createEncoder();
          encoding.writeVarUint(enc, messageCustom);
          encoding.writeVarUint(enc, subType);
          encoding.writeVarString(enc, JSON.stringify(payload));
          _send(encoding.toUint8Array(enc));
        },
      };

      function _setState(s) {
        room.status = s;
        onStatus && onStatus(s);
      }

      function _send(data) {
        if (ws.readyState === WebSocket.OPEN) ws.send(data);
      }

      ydoc.on('update', (update, origin) => {
        if (origin === ws) return;
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.writeUpdate(encoder, update);
        _send(encoding.toUint8Array(encoder));
      });

      awareness.on('update', ({ added, updated, removed }) => {
        const changed = added.concat(updated, removed);
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageAwareness);
        encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, changed));
        _send(encoding.toUint8Array(encoder));
        const states = Object.fromEntries([...awareness.getStates().entries()].map(([k, v]) => [k, v.user]));
        room.cursors = states;
        onAwareness && onAwareness(states);
      });

      ws.addEventListener('open', () => {
        _setState('open');
        const init = encoding.createEncoder();
        encoding.writeVarUint(init, messageSync);
        syncProtocol.writeSyncStep1(init, ydoc);
        _send(encoding.toUint8Array(init));
        awareness.setLocalStateField('user', {
          id: user.id,
          name: user.name || user.username,
          avatar: user.avatar,
          color: _colorForId(user.id || noteId),
        });
      });

      ws.addEventListener('message', (event) => {
        try {
          const data = new Uint8Array(event.data);
          const decoder = decoding.createDecoder(data);
          const encoder = encoding.createEncoder();
          const messageType = decoding.readVarUint(decoder);
          if (messageType === messageSync) {
            syncProtocol.readSyncMessage(decoder, encoder, ydoc, ws);
            if (encoding.length(encoder) > 1) _send(encoding.toUint8Array(encoder));
          } else if (messageType === messageAwareness) {
            awarenessProtocol.applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), ws);
          } else if (messageType === messageCustom) {
            try {
              const subType = decoding.readVarUint(decoder);
              const payload = JSON.parse(decoding.readVarString(decoder));
              onCustom && onCustom(subType, payload);
            } catch (e) { console.warn('custom msg parse err', e); }
          }
        } catch (e) {
          console.error('ws message error', e);
        }
      });

      ws.addEventListener('close', () => {
        _setState('closed');
        awareness.setLocalState(null);
      });

      ws.addEventListener('error', () => _setState('error'));

      return room;
    },
  },
});

function _colorForId(id) {
  let h = 0;
  for (let i = 0; i < (id || '').length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 75%, 55%)`;
}
