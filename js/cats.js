// 카페 고양이들: 행동(방장 컴퓨터에서 계산) + 다른 손님 화면에는 위치 동기화
import * as THREE from 'three';
import { CatModel, ANIMS } from './catModel.js';
import { CONFIG } from './config.js';
import { WORLD } from './room.js';
import { pushOut, randomFloorPoint, route, isOutdoor } from './nav.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const angDamp = (a, b, k, dt) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * (1 - Math.exp(-k * dt));
};
const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

// 고양이 성격: 행동 가중치
const TRAITS = {
  cheese:   { climb: 1, box: 0.6, spot: 1, wander: 1.2, guest: 2.2, stretch: 0.8, stove: 0.8, sun: 1, garden: 1.0, birds: 0.6 },
  calico:   { climb: 0.8, box: 0.8, spot: 1.6, wander: 0.8, guest: 1.2, stretch: 0.7, stove: 1.2, sun: 1.4, garden: 1.2, birds: 0.5 },
  mackerel: { climb: 2.4, box: 0.5, spot: 0.6, wander: 1, guest: 0.8, stretch: 0.8, stove: 0.6, sun: 0.8, garden: 0.8, birds: 1.4 },
  tuxedo:   { climb: 1.2, box: 0.6, spot: 1, wander: 1.4, guest: 1.6, stretch: 1, stove: 0.8, sun: 0.8, garden: 1.4, birds: 1.0 },
  black:    { climb: 1, box: 2.4, spot: 0.8, wander: 0.7, guest: 1, stretch: 0.7, stove: 1, sun: 0.4, garden: 0.6, birds: 0.8 },
};

export class CatCafe {
  constructor(scene, room, fx, sound) {
    this.scene = scene;
    this.room = room;
    this.fx = fx;
    this.sound = sound;
    this.isHost = true;
    this.cats = [];
    this.reserved = new Set();
    this.getGuests = () => [];
    this.night = 0;
    const starts = [V(-1.2, 0, 2.2), V(2.0, 0, -0.8), V(-5.6, 0, -0.6), V(3.4, 0, 1.2), V(1.6, 0, 2.6)];
    CONFIG.cats.forEach((def, i) => {
      const model = new CatModel(def.pattern, null, i + 1, 1.32);
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.36, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 0.25;
      hit.userData.catId = def.id;
      model.root.add(hit);
      scene.add(model.root);
      const cat = {
        def, model, hit, idx: i,
        pos: starts[i % starts.length].clone(), yaw: Math.random() * 6.28,
        queue: [], step: null, loc: { kind: 'floor' }, speed: 0, anim: 'idle',
        net: null, zzz: 0, traits: TRAITS[def.pattern] || TRAITS.cheese,
      };
      // 처음엔 각자 다른 자세로
      cat.queue.push({ type: 'pose', anim: pick(['loaf', 'sit', 'sleep', 'groom']), dur: rand(2, 7) });
      this.cats.push(cat);
    });
  }

  find(id) { return this.cats.find((c) => c.def.id === id); }
  hitObjects() { return this.cats.map((c) => c.hit); }

  // ---------------- 행동 고르기 ----------------
  plan(cat) {
    const q = cat.queue;
    if (cat.loc.kind !== 'floor') { this.exitSteps(cat); return; }
    const t = cat.traits;
    const guests = this.getGuests();
    const choices = [
      ['wander', t.wander],
      ['climb', t.climb],
      ['box', t.box],
      ['spot', t.spot],
      ['stretch', t.stretch],
      ['guest', guests.length ? t.guest : 0],
      ['stove', t.stove * (0.4 + this.night * 1.5)],
      ['sun', t.sun * (1 - this.night)],
      ['garden', t.garden * (this.rain ? 0.05 : 1 - this.night * 0.7)],
      ['birds', this.birdsPresent?.() ? t.birds : 0],
    ];
    const sum = choices.reduce((s, c) => s + c[1], 0);
    let r = Math.random() * sum, choice = 'wander';
    for (const [k, w] of choices) { if ((r -= w) <= 0) { choice = k; break; } }

    if (choice === 'wander') {
      q.push({ type: 'walk', to: randomFloorPoint(this.room, 0.2, this.night > 0.5 || this.rain ? 'in' : undefined) });
      q.push({ type: 'pose', anim: pick(['sit', 'idle', 'groom', 'sit']), dur: rand(3, 7) });
    } else if (choice === 'garden') {
      const spots = this.room.gardenSpots;
      const to = spots.length && Math.random() < 0.5 ? pick(spots).clone() : randomFloorPoint(this.room, 0.2, 'out');
      q.push({ type: 'walk', to });
      q.push({ type: 'pose', anim: pick(['sit', 'loaf', 'groom', 'loaf', 'stretch']), dur: rand(8, 20) });
    } else if (choice === 'birds') {
      // 새 모이대를 바라보며 꼬리를 흔듦 (채터링 소리는 다음 단계)
      const f = this.room.birdFeeder;
      const to = f.clone().add(V(rand(-1.2, -0.7), 0, rand(0.6, 1.2)));
      pushOut(this.room, to, 0.15);
      q.push({ type: 'walk', to });
      q.push({ type: 'face', yaw: yawTo(to, f) });
      q.push({ type: 'pose', anim: 'sit', dur: rand(6, 12), watch: true });
    } else if (choice === 'stretch') {
      q.push({ type: 'pose', anim: 'stretch', dur: 2.6 });
      q.push({ type: 'pose', anim: 'idle', dur: 0.8 });
      q.push({ type: 'walk', to: randomFloorPoint(this.room, 0.2) });
    } else if (choice === 'climb') {
      const p = pick(this.room.products);
      const P = p.path;
      const ends = [0, P.length - 1].filter((i) => P[i].y < 0.05);
      const start = pick(ends);
      const dir = start === 0 ? 1 : -1;
      const inner = [];
      for (let i = start + dir; i >= 0 && i < P.length && P[i].y > 0.05; i += dir) inner.push(i);
      const free = inner.filter((i) => !this.reserved.has(`${p.key}:${i}`));
      if (!free.length) return this.plan_wander(cat);
      // 높은 곳일수록 조금 더 자주
      const target = free[Math.min(free.length - 1, Math.floor(Math.pow(Math.random(), 0.7) * free.length))];
      const key = `${p.key}:${target}`;
      this.reserved.add(key);
      q.push({ type: 'walk', to: P[start].clone() });
      for (let i = start + dir; ; i += dir) {
        q.push({ type: 'hop', to: P[i].clone() });
        if (i === target) break;
      }
      const face = p.rotY + rand(-0.6, 0.6);
      q.push({ type: 'face', yaw: face });
      q.push({ type: 'pose', anim: pick(['loaf', 'sleep', 'sit', 'loaf', 'groom']), dur: rand(10, 26) });
      q.push({ type: 'loc', loc: { kind: 'path', p, index: target, key } });
    } else if (choice === 'box') {
      const boxes = this.room.boxes.filter((b) => !(b.outdoor && (this.rain || this.night > 0.5))).map((b) => ({ b, key: b.key }));
      const free = boxes.filter((x) => !this.reserved.has(x.key));
      if (!free.length) return this.plan_wander(cat);
      const { b, key } = pick(free);
      this.reserved.add(key);
      q.push({ type: 'walk', to: b.floor.clone() });
      q.push({ type: 'face', yaw: b.rotY + Math.PI });
      q.push({ type: 'hop', to: b.inside.clone(), keepYaw: true, low: true });
      q.push({ type: 'face', yaw: b.rotY + Math.PI * 0.85 });
      q.push({ type: 'pose', anim: 'sleep', dur: rand(18, 40) });
      q.push({ type: 'loc', loc: { kind: 'box', b, key } });
    } else if (choice === 'spot') {
      const spots = this.room.benchSpots.map((s, i) => ({ s, key: `spot${i}` })).filter((x) => !this.reserved.has(x.key));
      if (!spots.length) return this.plan_wander(cat);
      const { s, key } = pick(spots);
      this.reserved.add(key);
      const floorPt = this.floorNear(s);
      q.push({ type: 'walk', to: floorPt });
      if (s.y > 0.15) q.push({ type: 'hop', to: s.clone() });
      else q.push({ type: 'walk', to: V(s.x, 0, s.z), noCollide: true });
      q.push({ type: 'face', yaw: rand(-3, 3) });
      q.push({ type: 'pose', anim: pick(['loaf', 'sleep', 'loaf', 'sit']), dur: rand(12, 30) });
      q.push({ type: 'loc', loc: { kind: 'spot', s, floorPt, key } });
    } else if (choice === 'guest') {
      const g = pick(guests);
      const d = cat.pos.clone().sub(g.pos).setY(0);
      if (d.lengthSq() < 0.01) d.set(1, 0, 0);
      d.normalize().multiplyScalar(0.55);
      const to = g.pos.clone().setY(0).add(d);
      pushOut(this.room, to, 0.14);
      q.push({ type: 'walk', to });
      q.push({ type: 'faceGuest', guest: g.id });
      q.push({ type: 'pose', anim: pick(['sit', 'loaf', 'sit']), dur: rand(8, 16) });
    } else if (choice === 'stove') {
      const s = this.room.stoveSpot.clone().add(V(rand(-0.25, 0.25), 0, rand(-0.3, 0.3)));
      q.push({ type: 'walk', to: s });
      q.push({ type: 'face', yaw: Math.PI / 2 + rand(-0.6, 0.6) });
      q.push({ type: 'pose', anim: pick(['loaf', 'sleep']), dur: rand(14, 30) });
    } else if (choice === 'sun') {
      const s = V(rand(-0.9, 0.9), 0, rand(-3.6, -2.6));
      q.push({ type: 'walk', to: s });
      q.push({ type: 'pose', anim: 'stretch', dur: 2.4 });
      q.push({ type: 'pose', anim: pick(['loaf', 'sleep']), dur: rand(12, 24) });
    }
  }
  plan_wander(cat) {
    cat.queue.push({ type: 'walk', to: randomFloorPoint(this.room, 0.2) });
    cat.queue.push({ type: 'pose', anim: 'sit', dur: rand(2, 5) });
  }

  floorNear(s) {
    // 높은 자리 바로 앞 바닥 지점 (장애물 밖으로 밀어냄)
    const p = V(s.x, 0, s.z);
    const toCenter = V(-s.x, 0, -s.z).normalize().multiplyScalar(0.25);
    p.add(toCenter);
    pushOut(this.room, p, 0.16);
    return p;
  }

  // 높은 곳 · 상자 안에서 바닥으로 내려오기
  exitSteps(cat) {
    const q = cat.queue;
    const loc = cat.loc;
    if (loc.key) this.reserved.delete(loc.key);
    if (loc.kind === 'path') {
      const P = loc.p.path;
      const ends = [0, P.length - 1].filter((i) => P[i].y < 0.05);
      const end = pick(ends);
      const dir = end > loc.index ? 1 : -1;
      for (let i = loc.index + dir; ; i += dir) {
        q.push({ type: 'hop', to: P[i].clone() });
        if (i === end) break;
      }
      if (Math.random() < 0.5) q.push({ type: 'pose', anim: 'stretch', dur: 2.4 });
    } else if (loc.kind === 'box') {
      q.push({ type: 'pose', anim: 'loaf', dur: 1.5 });
      q.push({ type: 'hop', to: loc.b.floor.clone(), low: true });
      q.push({ type: 'pose', anim: 'stretch', dur: 2.6 });
    } else if (loc.kind === 'spot') {
      if (loc.s.y > 0.15) q.push({ type: 'hop', to: loc.floorPt.clone() });
      else q.push({ type: 'walk', to: loc.floorPt.clone(), noCollide: true });
    } else if (loc.kind === 'air') {
      const p = cat.pos.clone().setY(0);
      pushOut(this.room, p, 0.16);
      q.push({ type: 'hop', to: p });
    }
    q.push({ type: 'loc', loc: { kind: 'floor' } });
  }

  // ---------------- 손님의 손길 ----------------
  pet(id, fromPos, local = true) {
    const cat = this.find(id);
    if (!cat) return;
    this.fx.hearts(cat.model.headWorld(), 3);
    if (local) this.sound.purr(4.5);
    if (!this.isHost) return;
    this.interrupt(cat);
    if (fromPos) cat.queue.push({ type: 'face', yaw: yawTo(cat.pos, fromPos) });
    cat.queue.push({ type: 'pose', anim: 'petted', dur: 4.5 });
  }

  treat(id, fromPos, local = true) {
    const cat = this.find(id);
    if (!cat) return;
    if (local) this.sound.meow();
    setTimeout(() => {
      this.fx.text(cat.model.headWorld(), '냠냠', '#c66b3d');
      if (local) this.sound.crunch();
    }, 700);
    setTimeout(() => this.fx.hearts(cat.model.headWorld(), 4), 2400);
    if (!this.isHost) return;
    this.interrupt(cat);
    if (fromPos && cat.loc.kind === 'floor') {
      const d = cat.pos.clone().sub(fromPos).setY(0);
      if (d.length() > 0.6) {
        const to = fromPos.clone().setY(0).add(d.normalize().multiplyScalar(0.5));
        pushOut(this.room, to, 0.14);
        cat.queue.push({ type: 'walk', to, fast: true });
      }
    }
    if (fromPos) cat.queue.push({ type: 'face', yaw: yawTo(cat.pos, fromPos) });
    cat.queue.push({ type: 'pose', anim: 'eat', dur: 3.2 });
    cat.queue.push({ type: 'pose', anim: 'petted', dur: 2.5 });
    cat.queue.push({ type: 'pose', anim: 'sit', dur: 4 });
  }

  interrupt(cat) {
    // 진행 중인 점프는 끝까지 마침
    const keep = [];
    if (cat.step && cat.step.type === 'hop') keep.push(cat.step);
    // 높은 곳 상태(loc)는 큐에서 결정되므로, 쌓여 있던 loc 설정은 유지
    const pendingLoc = cat.queue.filter((s) => s.type === 'loc').pop();
    cat.queue = [];
    if (cat.step && cat.step.type === 'hop') { cat.queue.push(cat.step); }
    if (pendingLoc) cat.queue.push(pendingLoc);
    cat.step = null;
    void keep;
  }

  // ---------------- 방장이 되었을 때: 받은 위치에서 이어받기 ----------------
  adopt() {
    this.reserved.clear();
    for (const cat of this.cats) {
      cat.queue = []; cat.step = null;
      if (cat.pos.y < 0.05) { cat.loc = { kind: 'floor' }; cat.pos.y = 0; continue; }
      let best = null, bd = 0.35;
      for (const p of this.room.products) {
        p.path.forEach((pt, i) => { const d = pt.distanceTo(cat.pos); if (d < bd && pt.y > 0.05) { bd = d; best = { kind: 'path', p, index: i, key: `${p.key}:${i}` }; } });
      }
      this.room.boxes.forEach((b) => { const d = b.inside.distanceTo(cat.pos); if (d < bd) { bd = d; best = { kind: 'box', b, key: b.key }; } });
      this.room.benchSpots.forEach((s, i) => { const d = s.distanceTo(cat.pos); if (d < bd) { bd = d; best = { kind: 'spot', s, floorPt: this.floorNear(s), key: `spot${i}` }; } });
      cat.loc = best || { kind: 'air' };
      if (best?.key) this.reserved.add(best.key);
      cat.queue.push({ type: 'pose', anim: cat.anim === 'walk' ? 'sit' : cat.anim, dur: rand(2, 6) });
    }
  }

  // ---------------- 매 프레임 ----------------
  update(dt, t) {
    for (const cat of this.cats) {
      if (this.isHost) this.simulate(cat, dt);
      else this.follow(cat, dt);
      cat.model.root.position.copy(cat.pos);
      cat.model.root.rotation.y = cat.yaw;
      cat.model.setAnim(cat.anim);
      cat.model.update(dt, cat.speed);
      // 잠든 고양이 위로 z z
      if (cat.anim === 'sleep') {
        cat.zzz -= dt;
        if (cat.zzz < 0) { cat.zzz = 2.4; this.fx.zzz(cat.model.headWorld()); }
      }
    }
  }

  simulate(cat, dt) {
    if (!cat.step) {
      if (!cat.queue.length) this.plan(cat);
      cat.step = cat.queue.shift() || { type: 'pose', anim: 'idle', dur: 1 };
      cat.step.t = 0;
      // 실내 ↔ 정원은 문을 거쳐서
      if (cat.step.type === 'walk' && !cat.step.routed && isOutdoor(cat.pos) !== isOutdoor(cat.step.to)) {
        const wps = route(cat.pos, cat.step.to);
        const last = { ...cat.step, routed: true };
        cat.queue.unshift(...wps.slice(1, -1).map((w) => ({ type: 'walk', to: w, routed: true, noCollide: false })), last);
        cat.step = { type: 'walk', to: wps[0], routed: true, t: 0 };
      }
      if (cat.step.type === 'hop') {
        cat.step.from = cat.pos.clone();
        const d = cat.step.from.distanceTo(cat.step.to);
        cat.step.dur = 0.42 + d * 0.22;
        const dy = cat.step.to.y - cat.step.from.y;
        cat.step.arc = cat.step.low ? 0.12 : Math.max(0.16, dy > 0 ? 0.18 : 0.12);
        if (!cat.step.keepYaw && Math.hypot(cat.step.to.x - cat.pos.x, cat.step.to.z - cat.pos.z) > 0.05) cat.step.yaw = yawTo(cat.pos, cat.step.to);
      }
    }
    const s = cat.step;
    s.t += dt;
    cat.speed = 0;
    switch (s.type) {
      case 'walk': {
        const d = s.to.clone().sub(cat.pos).setY(0);
        const dist = d.length();
        const sp = s.fast ? 1.0 : 0.55;
        if (dist < 0.05 || s.t > 14) { cat.step = null; cat.anim = 'idle'; break; }
        // 먼저 몸을 돌리고 걷기
        const want = Math.atan2(d.x, d.z);
        cat.yaw = angDamp(cat.yaw, want, 8, dt);
        const facing = Math.cos(want - cat.yaw);
        const v = sp * Math.max(0, facing) * Math.min(1, dist / 0.25 + 0.3);
        cat.pos.addScaledVector(d.normalize(), v * dt);
        if (!s.noCollide) pushOut(this.room, cat.pos, 0.13);
        cat.pos.y = 0;
        cat.speed = v;
        cat.anim = 'walk';
        break;
      }
      case 'hop': {
        const k = Math.min(1, s.t / s.dur);
        if (s.yaw !== undefined) cat.yaw = angDamp(cat.yaw, s.yaw, 14, dt);
        if (k < 0.2) { cat.anim = 'sit'; break; } // 웅크렸다가
        const u = (k - 0.2) / 0.8;
        const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        cat.pos.lerpVectors(s.from, s.to, e);
        cat.pos.y += s.arc * 4 * u * (1 - u);
        cat.anim = 'jump';
        if (k >= 1) { cat.pos.copy(s.to); cat.step = null; cat.anim = 'idle'; }
        break;
      }
      case 'face':
        cat.yaw = angDamp(cat.yaw, s.yaw, 6, dt);
        if (s.t > 0.5) cat.step = null;
        break;
      case 'faceGuest': {
        const g = this.getGuests().find((x) => x.id === s.guest);
        if (g) cat.yaw = angDamp(cat.yaw, yawTo(cat.pos, g.pos), 6, dt);
        if (s.t > 0.5) cat.step = null;
        break;
      }
      case 'pose':
        cat.anim = s.anim;
        if (s.t > s.dur) cat.step = null;
        break;
      case 'loc':
        cat.loc = s.loc;
        cat.step = null;
        break;
      default:
        cat.step = null;
    }
    // 손님을 바라보며 고개 돌리기
    cat.model.lookYaw = 0;
    if (cat.anim === 'sit' || cat.anim === 'idle' || cat.anim === 'loaf') {
      const g = this.getGuests()[0];
      if (g) {
        const rel = ((yawTo(cat.pos, g.pos) - cat.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        if (Math.abs(rel) < 1.2 && cat.pos.distanceTo(g.pos) < 3) cat.model.lookYaw = rel * 0.6;
      }
    }
    // 판 밖으로 나가지 않게
    cat.pos.x = THREE.MathUtils.clamp(cat.pos.x, WORLD.minX + 0.15, WORLD.maxX - 0.15);
    cat.pos.z = THREE.MathUtils.clamp(cat.pos.z, WORLD.minZ + 0.15, WORLD.maxZ - 0.15);
    // 새 모이대 가까이 다가가면 새가 날아감
    if (this.room.birdFeeder && cat.pos.distanceTo(this.room.birdFeeder) < 0.55) this.room.scareBirds?.();
  }

  follow(cat, dt) {
    const n = cat.net;
    if (!n) return;
    const before = cat.pos.clone();
    const far = cat.pos.distanceTo(n.pos) > 2.5;
    if (far) cat.pos.copy(n.pos);
    else cat.pos.lerp(n.pos, 1 - Math.exp(-9 * dt));
    cat.yaw = angDamp(cat.yaw, n.yaw, 9, dt);
    cat.anim = n.anim;
    cat.speed = n.anim === 'walk' ? before.distanceTo(cat.pos) / Math.max(dt, 1e-3) : 0;
  }

  // ---------------- 네트워크 ----------------
  snapshot() {
    return this.cats.map((c) => [
      +c.pos.x.toFixed(3), +c.pos.y.toFixed(3), +c.pos.z.toFixed(3), +c.yaw.toFixed(2), ANIMS.indexOf(c.anim),
    ]);
  }
  applySnapshot(arr) {
    arr.forEach((a, i) => {
      const cat = this.cats[i];
      if (!cat) return;
      if (!cat.net) { cat.net = { pos: V(a[0], a[1], a[2]) }; cat.pos.set(a[0], a[1], a[2]); }
      cat.net.pos.set(a[0], a[1], a[2]);
      cat.net.yaw = a[3];
      cat.net.anim = ANIMS[a[4]] || 'idle';
    });
  }
}
