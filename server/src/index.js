// 고양이서가 카페 방 서버
// - 방(호점)마다 Durable Object 하나가 손님 목록과 메시지 전달을 맡습니다.
// - 고양이 움직임은 방 안의 손님 한 명(가장 먼저 들어온 사람)의 브라우저가 정하고,
//   "어디로 간다 · 무엇을 한다"는 계획만 서버를 거쳐 나눠 줍니다. 걷는 모습은 각자 브라우저가 그립니다.
// - 무료 플랜 절약: WebSocket Hibernation API를 써서, 메시지가 없을 땐 서버가 잠들고 실행시간이 쌓이지 않습니다.
//   연결 유지용 'ping'에는 서버를 깨우지 않고 자동으로 'pong'이 나갑니다.
// - 로비(Lobby)는 방마다 몇 명이 있는지 기억해 "빈 자리 있는 방"을 알려 줍니다.
import { DurableObject } from 'cloudflare:workers';

const json = (data, init = {}, origin = '*') => new Response(JSON.stringify(data), {
  ...init,
  headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': origin, 'cache-control': 'no-store', ...(init.headers || {}) },
});

function allowedOrigin(req, env) {
  const origin = req.headers.get('origin') || '';
  const list = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!origin) return { ok: true, origin: '*' };
  return { ok: list.includes(origin), origin: list.includes(origin) ? origin : 'null' };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const { ok, origin } = allowedOrigin(req, env);
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET', 'access-control-max-age': '86400' } });
    }
    if (url.pathname === '/' || url.pathname === '/health') return json({ ok: true, name: 'catseoga-cafe' }, {}, origin);
    if (!ok) return new Response('forbidden origin', { status: 403 });

    const cap = +env.ROOM_CAP || 50;
    const max = +env.MAX_ROOMS || 20;
    const lobby = env.LOBBY.get(env.LOBBY.idFromName('lobby'));

    if (url.pathname === '/rooms') {
      const r = await lobby.list(cap, max);
      return json(r, {}, origin);
    }

    const m = url.pathname.match(/^\/room\/(\d{1,4})\/ws$/);
    if (m) {
      const n = +m[1];
      if (n < 1 || n > max) return new Response('no such room', { status: 404 });
      if (req.headers.get('upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
      const stub = env.ROOM.get(env.ROOM.idFromName(`room-${n}`));
      const fwd = new Request(req, { headers: new Headers(req.headers) });
      fwd.headers.set('x-room', String(n));
      fwd.headers.set('x-cap', String(cap));
      return stub.fetch(fwd);
    }
    return new Response('not found', { status: 404 });
  },
};

// ---------------- 로비: 방별 인원 ----------------
export class Lobby extends DurableObject {
  async report(n, count) {
    const counts = (await this.ctx.storage.get('counts')) || {};
    if (count > 0) counts[n] = { c: count, t: Date.now() }; else delete counts[n];
    await this.ctx.storage.put('counts', counts);
  }
  async list(cap, max) {
    const counts = (await this.ctx.storage.get('counts')) || {};
    const now = Date.now();
    const rooms = [];
    let highest = 0;
    for (let n = 1; n <= max; n++) {
      const e = counts[n];
      // 10분 넘게 소식 없는 기록은 비었다고 봄
      const c = e && now - e.t < 10 * 60 * 1000 ? e.c : 0;
      if (c > 0) highest = n;
      rooms.push({ n, count: c });
    }
    const best = rooms.find((r) => r.count > 0 && r.count < cap) || rooms.find((r) => r.count === 0) || null;
    // 손님이 있는 방 + 빈 방 하나만 보여 줌
    const shown = rooms.filter((r) => r.n <= Math.max(highest + 1, 1));
    return { cap, max, best: best ? best.n : null, rooms: shown };
  }
}

// ---------------- 방 하나 ----------------
const MAX_MSG = 4096;
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f]/g, '').slice(0, n);

export class CafeRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.rate = new Map(); // 도배 방지 (잠들면 비워져도 괜찮음)
    // 'ping' → 'pong' 은 서버를 깨우지 않고 자동 응답
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  sockets() { return this.ctx.getWebSockets().filter((w) => w.readyState === 1); }

  async fetch(req) {
    const n = +req.headers.get('x-room');
    const cap = +req.headers.get('x-cap') || 50;
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    const others = this.sockets().filter((w) => w !== server);
    if (others.length >= cap) {
      server.send(JSON.stringify({ t: 'full', cap }));
      server.close(4001, 'full');
      return new Response(null, { status: 101, webSocket: client });
    }
    server.serializeAttachment({ n, uid: null, seq: Date.now() + Math.random(), host: false, hi: null, st: null });
    return new Response(null, { status: 101, webSocket: client });
  }

  send(ws, m) { try { ws.send(JSON.stringify(m)); } catch { /* 무시 */ } }
  broadcast(m, except) {
    const s = JSON.stringify(m);
    for (const w of this.sockets()) if (w !== except && w.deserializeAttachment()?.uid) { try { w.send(s); } catch { /* 무시 */ } }
  }

  async webSocketMessage(ws, data) {
    if (typeof data !== 'string' || data.length > MAX_MSG) return;
    // 1초에 20개 넘게 보내면 무시
    const now = Date.now();
    const r = this.rate.get(ws) || { t: now, c: 0 };
    if (now - r.t > 1000) { r.t = now; r.c = 0; }
    if (++r.c > 20) { this.rate.set(ws, r); return; }
    this.rate.set(ws, r);

    let m;
    try { m = JSON.parse(data); } catch { return; }
    if (!m || typeof m !== 'object') return;
    const att = ws.deserializeAttachment() || {};

    if (m.t === 'hello') {
      if (att.uid) return;
      att.uid = clean(m.uid, 16) || Math.random().toString(36).slice(2, 10);
      // 같은 uid로 다시 들어오면 예전 연결 정리
      for (const w of this.sockets()) {
        if (w !== ws && w.deserializeAttachment()?.uid === att.uid) { try { w.close(4002, 'replaced'); } catch { /* 무시 */ } }
      }
      att.hi = this.hiOf(m, att.uid);
      ws.serializeAttachment(att);
      const members = this.sockets().filter((w) => w !== ws).map((w) => w.deserializeAttachment()).filter((a) => a && a.uid && a.uid !== att.uid);
      this.send(ws, { t: 'welcome', room: att.n, members: members.map((a) => ({ hi: a.hi, st: a.st })) });
      this.broadcast(att.hi, ws);
      this.ensureHost();
      await this.report(att.n);
      return;
    }
    if (!att.uid) return;
    m.uid = att.uid; // 남의 이름으로 보내지 못하게

    switch (m.t) {
      case 'hi':
        att.hi = this.hiOf(m, att.uid);
        ws.serializeAttachment(att);
        this.broadcast(att.hi, ws);
        break;
      case 'st':
        // p: 지금 위치, g: 걸어갈 목적지(있으면 받는 쪽이 알아서 걸어감), s: 앉은 자리
        att.st = { t: 'st', uid: att.uid, p: m.p, s: m.s, g: m.g };
        ws.serializeAttachment(att);
        this.broadcast(att.st, ws);
        break;
      case 'cq': case 'cs':
        // 고양이 계획: 고양이 담당 손님만 보낼 수 있음
        if (!att.host) return;
        this.broadcast(m, ws);
        break;
      case 'pet': case 'treat': case 'wave': case 'fx':
        this.broadcast(m, ws);
        break;
      default:
        break;
    }
  }

  hiOf(m, uid) {
    return { t: 'hi', uid, n: clean(m.n, 12) || '손님', l: m.l && typeof m.l === 'object' ? m.l : null, mc: m.mc && typeof m.mc === 'object' ? m.mc : null };
  }

  // 고양이를 계산할 손님 정하기
  ensureHost() {
    const list = this.sockets().map((w) => ({ w, a: w.deserializeAttachment() })).filter((x) => x.a && x.a.uid);
    if (list.some((x) => x.a.host)) return;
    list.sort((p, q) => p.a.seq - q.a.seq);
    const h = list[0];
    if (!h) return;
    h.a.host = true;
    h.w.serializeAttachment(h.a);
    this.send(h.w, { t: 'role', host: true });
  }

  async webSocketClose(ws, code) {
    await this.leave(ws);
    try { ws.close(code === 1005 ? 1000 : code, 'bye'); } catch { /* 무시 */ }
  }
  async webSocketError(ws) { await this.leave(ws); }

  async leave(ws) {
    const att = ws.deserializeAttachment();
    this.rate.delete(ws);
    if (!att || !att.uid || att.left) return;
    att.left = true;
    att.host = false;
    try { ws.serializeAttachment(att); } catch { /* 무시 */ }
    this.broadcast({ t: 'bye', uid: att.uid }, ws);
    this.ensureHost();
    await this.report(att.n);
  }

  async report(n) {
    const count = this.sockets().filter((w) => { const a = w.deserializeAttachment(); return a && a.uid && !a.left; }).length;
    try { await this.env.LOBBY.get(this.env.LOBBY.idFromName('lobby')).report(n, count); } catch { /* 무시 */ }
  }
}
