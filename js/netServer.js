// Cloudflare 방 서버 연결 (방마다 최대 50명)
import { CONFIG } from './config.js';

export async function fetchRooms() {
  const base = CONFIG.serverUrl.replace(/\/$/, '');
  const r = await fetch(`${base}/rooms`, { cache: 'no-store' });
  if (!r.ok) throw new Error('rooms ' + r.status);
  return r.json(); // { cap, max, best, rooms: [{ n, count }] }
}

export class NetServer {
  constructor(uid, handlers) {
    this.uid = uid;
    this.h = handlers; // { onHost, onStatus, onMessage, onConnected, onFull, hello() }
    this.isHost = false;
    this.ws = null;
    this.room = null;
    this.stopped = false;
    this.attempt = 0;
    this.others = 0;
  }

  get hasPeers() { return this.others > 0; }

  start(room) {
    this.room = room;
    this.connect();
  }

  connect() {
    if (this.stopped) return;
    const base = CONFIG.serverUrl.replace(/\/$/, '').replace(/^http/, 'ws');
    const ws = this.ws = new WebSocket(`${base}/room/${this.room}/ws`);
    this.h.onStatus?.('reconnecting');
    ws.onopen = () => {
      this.attempt = 0;
      ws.send(JSON.stringify({ ...this.h.hello(), t: 'hello', uid: this.uid }));
    };
    ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'full') { this.full = true; return; }
      if (m.t === 'role') { this.setHost(!!m.host); return; }
      if (m.t === 'welcome') {
        this.h.onStatus?.('online');
        this.others = m.members.length;
        // 고양이 계산 담당이 아니면 받은 고양이 위치를 따름 (담당이면 바로 뒤에 role 메시지가 옴)
        this.h.onHost?.(this.isHost);
        for (const mem of m.members) {
          if (mem.hi) this.h.onMessage?.(mem.hi);
          if (mem.st) this.h.onMessage?.(mem.st);
        }
        if (m.cats && !this.isHost) this.h.onMessage?.({ t: 'cats', c: m.cats });
        this.h.onConnected?.();
        return;
      }
      if (m.t === 'hi' && m.uid !== this.uid) this.others = Math.max(this.others, 1);
      this.h.onMessage?.(m);
    };
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      this.setHost(false);
      if (this.full || e.code === 4001) { this.full = false; this.stopped = true; this.h.onFull?.(); return; }
      if (e.code === 4002) { this.stopped = true; this.h.onStatus?.('offline'); return; } // 다른 탭에서 같은 사람으로 들어옴
      this.h.onStatus?.('reconnecting');
      this.attempt++;
      const wait = Math.min(15000, 800 * 2 ** Math.min(this.attempt, 5)) * (0.7 + Math.random() * 0.6);
      clearTimeout(this.retry);
      this.retry = setTimeout(() => this.connect(), wait);
    };
  }

  setHost(v) {
    if (this.isHost === v) return;
    this.isHost = v;
    this.h.onHost?.(v);
  }

  send(msg) {
    msg.uid = this.uid;
    if (this.ws?.readyState === 1) {
      try { this.ws.send(JSON.stringify(msg)); } catch { /* 무시 */ }
    }
  }

  stop() { this.stopped = true; try { this.ws?.close(1000); } catch { /* 무시 */ } }
}
