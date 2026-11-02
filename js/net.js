// PeerJS(WebRTC) P2P: 서버 없이 여러 손님이 함께 머물기
// - 방에 처음 들어온 사람이 "방장" 아이디를 차지하고, 나머지는 방장에게 연결합니다.
// - 방장이 메시지를 모두에게 전달(별 모양 연결)하고, 고양이 움직임도 방장이 계산합니다.
// - 방장이 나가면 남은 사람 중 한 명이 자동으로 방장을 이어받습니다.
import { CONFIG } from './config.js';

export class Net {
  constructor(uid, handlers) {
    this.uid = uid;
    this.h = handlers;           // { onHost(bool), onMessage(msg), onStatus(text), onPeerLeft(uid) }
    const room = (new URLSearchParams(location.search).get('room') || 'main').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'main';
    this.hostId = `${CONFIG.roomPrefix}-${room}`;
    // 시험용: ?peerhost=localhost:9000 이면 직접 띄운 PeerServer 사용 (평소엔 PeerJS 무료 클라우드)
    const ph = new URLSearchParams(location.search).get('peerhost');
    this.opts = { debug: 0 };
    if (ph) { const [host, port] = ph.split(':'); Object.assign(this.opts, { host, port: +port || 9000, path: '/', secure: false }); }
    this.peer = null;
    this.isHost = false;
    this.conns = new Map();      // 방장일 때: peerId -> { conn, uid }
    this.hostConn = null;
    this.stopped = false;
    this.attempt = 0;
  }

  start() {
    if (!window.Peer) { this.h.onStatus?.('offline'); return; }
    this.tryHost();
  }

  // 1) 방장 아이디를 먼저 차지해 봄
  tryHost() {
    if (this.stopped) return;
    this.cleanup();
    const peer = this.peer = new window.Peer(this.hostId, this.opts);
    let settled = false;
    peer.on('open', () => {
      settled = true;
      this.isHost = true;
      this.attempt = 0;
      this.h.onHost?.(true);
      this.h.onStatus?.('online');
    });
    peer.on('connection', (conn) => this.acceptClient(conn));
    peer.on('error', (err) => {
      if (!settled && err.type === 'unavailable-id') { settled = true; this.joinAsClient(); return; }
      if (!settled) { settled = true; this.retryLater(); return; }
    });
    peer.on('disconnected', () => { if (this.isHost && !this.stopped) { try { peer.reconnect(); } catch { /* 무시 */ } } });
  }

  // 2) 이미 방장이 있으면 손님으로 연결
  joinAsClient() {
    if (this.stopped) return;
    this.cleanup();
    this.isHost = false;
    this.h.onHost?.(false);
    const peer = this.peer = new window.Peer(this.opts);
    peer.on('open', () => {
      const conn = peer.connect(this.hostId, { reliable: true, serialization: 'json' });
      this.hostConn = conn;
      const timeout = setTimeout(() => { if (!conn.open) this.retryLater(); }, 9000);
      conn.on('open', () => {
        clearTimeout(timeout);
        this.lastRx = Date.now();
        // 방장에게서 한동안 아무 소식이 없으면 끊긴 것으로 봄
        clearInterval(this.watchdog);
        this.watchdog = setInterval(() => {
          if (this.hostConn === conn && Date.now() - this.lastRx > 9000) { clearInterval(this.watchdog); this.retryLater(true); }
        }, 2000);
        this.attempt = 0;
        this.h.onStatus?.('online');
        this.h.onConnected?.();
      });
      conn.on('data', (msg) => {
        this.lastRx = Date.now();
        // 방장이 떠난다고 알리면 바로 방장 자리 이어받기 시도
        if (msg && msg.t === 'bye' && msg.host) { this.h.onMessage?.(msg); this.retryLater(true); return; }
        this.h.onMessage?.(msg);
      });
      conn.on('close', () => { if (this.hostConn === conn) this.retryLater(true); });
      conn.on('error', () => { if (this.hostConn === conn) this.retryLater(true); });
    });
    peer.on('error', (err) => {
      if (err.type === 'peer-unavailable') this.retryLater(true);
      else if (!this.hostConn?.open) this.retryLater();
    });
  }

  // 방장이 사라졌거나 서버 연결 실패 → 잠시 후 방장 자리부터 다시 시도
  retryLater(hostGone = false) {
    if (this.stopped || this._retry) return;
    this.cleanup();
    this.h.onStatus?.('reconnecting');
    if (hostGone) this.h.onHostLost?.();
    this.attempt++;
    const wait = hostGone ? 300 + Math.random() * 1800 : Math.min(20000, 1500 * this.attempt);
    this._retry = setTimeout(() => { this._retry = null; this.tryHost(); }, wait);
  }

  acceptClient(conn) {
    const entry = { conn, uid: null };
    this.conns.set(conn.peer, entry);
    conn.on('open', () => this.h.onClientOpen?.((m) => this.safeSend(conn, m)));
    conn.on('data', (msg) => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.uid) entry.uid = msg.uid;
      // 다른 손님들에게 전달 + 나도 처리
      this.relay(msg, conn.peer);
      this.h.onMessage?.(msg);
    });
    const gone = () => {
      if (!this.conns.has(conn.peer)) return;
      this.conns.delete(conn.peer);
      if (entry.uid) {
        const bye = { t: 'bye', uid: entry.uid };
        this.relay(bye, null);
        this.h.onMessage?.(bye);
      }
    };
    conn.on('close', gone);
    conn.on('error', gone);
  }

  relay(msg, exceptPeer) {
    for (const [pid, { conn }] of this.conns) if (pid !== exceptPeer) this.safeSend(conn, msg);
  }

  safeSend(conn, msg) { try { if (conn.open) conn.send(msg); } catch { /* 무시 */ } }

  // 내 메시지 보내기
  send(msg) {
    msg.uid = this.uid;
    if (msg.t === 'bye' && this.isHost) msg.host = true;
    if (this.isHost) this.relay(msg, null);
    else if (this.hostConn?.open) this.safeSend(this.hostConn, msg);
  }

  get count() { return this.isHost ? this.conns.size + 1 : null; }

  cleanup() {
    clearInterval(this.watchdog);
    if (this.hostConn) { try { this.hostConn.close(); } catch { /* 무시 */ } this.hostConn = null; }
    for (const { conn } of this.conns.values()) { try { conn.close(); } catch { /* 무시 */ } }
    this.conns.clear();
    if (this.peer) { try { this.peer.destroy(); } catch { /* 무시 */ } this.peer = null; }
    this.isHost = false;
  }

  stop() { this.stopped = true; this.cleanup(); }
}
