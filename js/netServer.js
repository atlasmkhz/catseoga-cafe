// Cloudflare 방 서버 연결 (방마다 최대 50명)
import { CONFIG } from './config.js';

export async function fetchRooms() {
  const base = CONFIG.serverUrl.replace(/\/$/, '');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 6000);
  const r = await fetch(`${base}/rooms`, { cache: 'no-store', signal: ctl.signal }).finally(() => clearTimeout(timer));
  if (!r.ok) throw new Error('rooms ' + r.status);
  return r.json(); // { cap, max, best, rooms: [{ n, count }] }
}

export class NetServer {
  constructor(uid, handlers) {
    this.uid = uid;
    this.h = handlers; // { onHost, onStatus, onMessage, onConnected, onFull, onServerDown, hello() }
    this.failures = 0; // 연결이 한 번도 안 되고 끊긴 횟수 (연속)
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
    let ws;
    try { ws = this.ws = new WebSocket(`${base}/room/${this.room}/ws`); } catch { this.serverDown(); return; }
    let welcomed = false;
    this.h.onStatus?.('reconnecting');
    // 8초 안에 들어가지 못하면 실패로 봄
    const openTimer = setTimeout(() => { if (!welcomed) { try { ws.close(); } catch { /* 무시 */ } } }, 8000);
    ws.onopen = () => {
      ws.send(JSON.stringify({ ...this.h.hello(), t: 'hello', uid: this.uid }));
    };
    ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'full') { this.full = true; return; }
      if (m.t === 'role') { this.setHost(!!m.host); return; }
      if (m.t === 'welcome') {
        welcomed = true;
        clearTimeout(openTimer);
        this.attempt = 0;
        this.failures = 0;
        // 연결 유지: 50초마다 'ping' (서버가 잠든 채로 자동 응답하므로 실행시간이 거의 안 듦)
        clearInterval(this.pinger);
        this.pinger = setInterval(() => { if (ws.readyState === 1) ws.send('ping'); }, 50000);
        this.h.onStatus?.('online');
        this.others = m.members.length;
        // 고양이 계산 담당이 아니면 받은 고양이 위치를 따름 (담당이면 바로 뒤에 role 메시지가 옴)
        this.h.onHost?.(this.isHost);
        for (const mem of m.members) {
          if (mem.hi) this.h.onMessage?.(mem.hi);
          if (mem.st) this.h.onMessage?.(mem.st);
        }
        this.h.onConnected?.();
        return;
      }
      if (m.t === 'hi' && m.uid !== this.uid) this.others = Math.max(this.others, 1);
      this.h.onMessage?.(m);
    };
    ws.onclose = (e) => {
      clearTimeout(openTimer);
      clearInterval(this.pinger);
      if (this.ws !== ws) return;
      this.setHost(false);
      if (this.full || e.code === 4001) { this.full = false; this.stopped = true; this.h.onFull?.(); return; }
      if (e.code === 4002) { this.stopped = true; this.h.onStatus?.('offline'); return; } // 다른 탭에서 같은 사람으로 들어옴
      // 서버가 무료 한도를 넘었거나 고장 나서 연속으로 못 들어가면 P2P로 전환
      if (!welcomed && ++this.failures >= 2) { this.serverDown(); return; }
      this.h.onStatus?.('reconnecting');
      this.attempt++;
      const wait = Math.min(15000, 800 * 2 ** Math.min(this.attempt, 5)) * (0.7 + Math.random() * 0.6);
      clearTimeout(this.retry);
      this.retry = setTimeout(() => this.connect(), wait);
    };
  }

  serverDown() {
    this.stopped = true;
    clearTimeout(this.retry);
    clearInterval(this.pinger);
    this.setHost(false);
    this.h.onServerDown?.();
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

  stop() { this.stopped = true; clearTimeout(this.retry); clearInterval(this.pinger); try { this.ws?.close(1000); } catch { /* 무시 */ } }
}
