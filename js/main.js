// 고양이서가 온라인 고양이 카페 — 시작 파일
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { IS_MOBILE } from './kit.js';
import { buildRoom, ROOM } from './room.js';
import { CatCafe } from './cats.js';
import { Avatar, LOOKS } from './avatar.js';
import { FX } from './fx.js';
import { Sound } from './audio.js';
import { Net } from './net.js';
import { Controls } from './controls.js';
import { pushOut } from './nav.js';
import { extractCatColors, FollowerCat } from './myCat.js';
import { UI } from './ui.js';

const store = {
  get(k, d) { try { const v = localStorage.getItem('catseoga.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('catseoga.' + k, JSON.stringify(v)); } catch { /* 무시 */ } },
};

// ---------- 렌더러 · 장면 ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_MOBILE ? 1.6 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const DAY_BG = new THREE.Color('#efe2cd'), NIGHT_BG = new THREE.Color('#1b2034');
scene.background = DAY_BG.clone();

const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);

// 빛
const hemi = new THREE.HemisphereLight('#fff1dc', '#b08a64', 1.15);
scene.add(hemi);
const ambient = new THREE.AmbientLight('#ffe7cc', 0.25);
scene.add(ambient);
const sun = new THREE.DirectionalLight('#ffe0b0', 2.6);
sun.position.set(-3.6, 10.5, -12);
sun.target.position.set(0, 0, 0);
sun.castShadow = true;
const SM = IS_MOBILE ? 1024 : 2048;
sun.shadow.mapSize.set(SM, SM);
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 2, far: 35 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
// 그림자 없는 부드러운 보조광 (앞쪽에서)
const fill = new THREE.DirectionalLight('#fff4e4', 0.45);
fill.position.set(4, 8, 10);
scene.add(fill);

const room = buildRoom(scene);
const fx = new FX(scene);
const sound = new Sound();
const cafe = new CatCafe(scene, room, fx, sound);
const ui = new UI();

// ---------- 나 ----------
const uid = store.get('uid', null) || Math.random().toString(36).slice(2, 10);
store.set('uid', uid);
const me = {
  name: store.get('name', ''),
  look: store.get('look', { top: LOOKS.tops[Math.floor(Math.random() * LOOKS.tops.length)], hair: LOOKS.hairs[0], skin: LOOKS.skins[0] }),
  avatar: null,
  pos: new THREE.Vector3(2.45, 0, 4.2),
  yaw: Math.PI,
  target: null,
  seat: null,
  pending: null,
  speed: 0,
  hold: null,
  entered: false,
  myCat: null,
  myCatInfo: store.get('mycat', null),
};

const remotes = new Map(); // uid -> { avatar, pos, yaw, tpos, tyaw, seat, last, cat, catInfoKey }

// ---------- 카메라 ----------
const cam = { yaw: 0.28, pitch: 0.72, dist: 15, target: new THREE.Vector3(0, 0.6, 0), shake: 0 };
function fitDist() {
  const a = camera.aspect;
  // 세로 화면(폰)은 조금 더 넓게 보고, 내 캐릭터를 더 가까이 따라감
  return a < 1 ? 13 / Math.max(0.62, a * 1.2) : 14.5;
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = camera.aspect < 1 ? 44 : 36;
  camera.updateProjectionMatrix();
  cam.maxDist = fitDist() * 1.25;
  if (!cam.userZoomed) cam.dist = fitDist();
}
window.addEventListener('resize', resize);
resize();

function updateCamera(dt) {
  // 내 캐릭터를 따라가되 방 안쪽 범위에서만 (디오라마가 한눈에 보이게)
  const want = me.entered ? me.pos.clone() : new THREE.Vector3(0, 0, 0);
  const portrait = camera.aspect < 1;
  const k = portrait ? 0.9 : 0.55;
  want.x = THREE.MathUtils.clamp(want.x * k, portrait ? -4.6 : -3, portrait ? 4.6 : 3);
  want.z = THREE.MathUtils.clamp(want.z * k, -2.6, 2.6);
  want.y = 0.6;
  cam.target.lerp(want, 1 - Math.exp(-2.5 * dt));
  if (!me.entered) cam.yaw += dt * 0.05;
  const cp = Math.cos(cam.pitch);
  camera.position.set(
    cam.target.x + Math.sin(cam.yaw) * cp * cam.dist,
    cam.target.y + Math.sin(cam.pitch) * cam.dist,
    cam.target.z + Math.cos(cam.yaw) * cp * cam.dist,
  );
  camera.lookAt(cam.target);
}

// ---------- 벽 잘라 보기 (카메라 쪽 벽은 투명하게) ----------
function updateWalls(dt) {
  const c = new THREE.Vector3(camera.position.x, 0, camera.position.z);
  for (const w of room.walls) {
    const d = c.dot(w.normal) - (Math.abs(w.normal.x) ? ROOM.maxX : ROOM.maxZ);
    const want = d > 0.5 ? 0 : 1;
    w.opacity += (want - w.opacity) * (1 - Math.exp(-8 * dt));
    if (Math.abs(w.opacity - want) < 0.01) w.opacity = want;
    const op = w.opacity;
    // 카메라 쪽 벽은 바닥으로 쏙 내려감 (디오라마 잘라 보기)
    const e = op * op * (3 - 2 * op);
    w.group.scale.y = Math.max(0.001, e);
    w.group.visible = op > 0.02;
    w.group.userData.fade = e;
  }
}

// ---------- 낮 · 밤 ----------
const hour = new Date().getHours();
const dayNight = { night: hour >= 19 || hour < 6 ? 1 : 0, target: hour >= 19 || hour < 6 ? 1 : 0 };
function updateDayNight(dt, t) {
  dayNight.night += (dayNight.target - dayNight.night) * (1 - Math.exp(-2 * dt));
  const n = dayNight.night;
  scene.background.copy(DAY_BG).lerp(NIGHT_BG, n);
  hemi.intensity = 1.15 - n * 0.8;
  hemi.color.set('#fff1dc').lerp(new THREE.Color('#7d88c0'), n);
  hemi.groundColor.set('#b08a64').lerp(new THREE.Color('#3b2c2a'), n);
  ambient.intensity = 0.25 - n * 0.1;
  sun.intensity = 2.6 - n * 2.25;
  sun.color.set('#ffe0b0').lerp(new THREE.Color('#9fb3ff'), n);
  fill.intensity = 0.45 - n * 0.3;
  renderer.toneMappingExposure = 1.05 - n * 0.05;
  cafe.night = n;
  room.update(dt, t, n);
}

// ---------- 손님 목록 (고양이가 찾아갈 대상) ----------
cafe.getGuests = () => {
  const list = [];
  if (me.entered) list.push({ id: uid, pos: me.pos });
  for (const [id, r] of remotes) list.push({ id, pos: r.pos });
  return list;
};

// ---------- 앉기 · 걷기 ----------
function seatApproach(seat) {
  const f = new THREE.Vector3(Math.sin(seat.rotY), 0, Math.cos(seat.rotY));
  const p = seat.pos.clone().setY(0).addScaledVector(f, seat.floor ? 0.45 : 0.5);
  return pushOut(room, p, 0.22);
}
function standUp() {
  if (!me.seat) return;
  me.pos.copy(seatApproach(me.seat));
  me.seat.taken = null;
  me.seat = null;
}
function walkTo(p, pending = null) {
  standUp();
  me.target = pushOut(room, p.clone().setY(0), 0.24);
  me.pending = pending;
}
function seatTakenByOther(seat) {
  const idx = room.seats.indexOf(seat);
  for (const r of remotes.values()) if (r.seat === idx) return true;
  return false;
}

function updateMe(dt) {
  if (!me.entered) return;
  const ctr = controls;
  const [ax, ay] = ctr.axis();
  cam.yaw += ctr.turn() * dt * 1.6;
  let moving = false;
  if (ax || ay) {
    standUp();
    me.target = null; me.pending = null;
    const fwd = new THREE.Vector3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
    const right = new THREE.Vector3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
    const dir = fwd.multiplyScalar(ay).add(right.multiplyScalar(ax)).normalize();
    me.pos.addScaledVector(dir, 1.8 * dt);
    me.yaw = dampAngle(me.yaw, Math.atan2(dir.x, dir.z), 12, dt);
    moving = true;
  } else if (me.hold) {
    const d = me.hold.clone().sub(me.pos).setY(0);
    if (d.length() > 0.15) {
      standUp();
      d.normalize();
      me.pos.addScaledVector(d, 1.8 * dt);
      me.yaw = dampAngle(me.yaw, Math.atan2(d.x, d.z), 12, dt);
      moving = true;
    }
  } else if (me.target) {
    const d = me.target.clone().sub(me.pos).setY(0);
    const dist = d.length();
    if (dist < 0.06) {
      me.target = null;
      arrive();
    } else {
      d.normalize();
      const step = Math.min(dist, 1.8 * dt);
      const before = me.pos.clone();
      me.pos.addScaledVector(d, step);
      me.yaw = dampAngle(me.yaw, Math.atan2(d.x, d.z), 12, dt);
      moving = true;
      pushOut(room, me.pos, 0.24);
      // 막혀서 못 가면 멈춤
      me.stuck = before.distanceTo(me.pos) < step * 0.2 ? (me.stuck || 0) + dt : 0;
      if (me.stuck > 0.4) { me.target = null; me.stuck = 0; arrive(); }
    }
  }
  if (!me.seat) pushOut(room, me.pos, 0.24);
  me.speed = moving ? 1.8 : 0;

  const a = me.avatar;
  if (me.seat) {
    me.pos.lerp(me.seat.pos.clone().setY(0), 1 - Math.exp(-12 * dt));
    me.yaw = dampAngle(me.yaw, me.seat.rotY, 10, dt);
  }
  a.root.position.copy(me.pos);
  a.root.position.y = me.seat ? (me.seat.pos.y - 0.38) * a.sitting : 0;
  a.root.rotation.y = me.yaw;
  a.update(dt, me.speed, !!me.seat);
  if (me.myCat) me.myCat.simulate(dt, me.pos, me.yaw);
}

function arrive() {
  const p = me.pending;
  me.pending = null;
  if (!p) return;
  if (p.type === 'seat') {
    if (seatTakenByOther(p.seat)) { ui.toast('누군가 앉아 있어요'); return; }
    me.seat = p.seat;
    p.seat.taken = uid;
  } else if (p.type === 'faceCat') {
    const c = cafe.find(p.id);
    if (c) me.yaw = Math.atan2(c.pos.x - me.pos.x, c.pos.z - me.pos.z);
  }
}

function dampAngle(a, b, k, dt) {
  const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * (1 - Math.exp(-k * dt));
}

// ---------- 누르기 ----------
const raycaster = new THREE.Raycaster();
raycaster.camera = camera;
const ndc = new THREE.Vector2();
function pick(x, y) {
  ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  // 1) 고양이
  const catHits = raycaster.intersectObjects([...cafe.hitObjects(), ...followerHits()], false);
  if (catHits.length) return { kind: 'cat', obj: catHits[0].object, point: catHits[0].point };
  // 2) 장면 전체
  const hits = raycaster.intersectObjects(scene.children, true).filter((h) => usable(h.object));
  if (!hits.length) return null;
  const h = hits[0];
  let o = h.object;
  while (o) { if (o.userData.product) return { kind: 'product', key: o.userData.product, point: h.point }; o = o.parent; }
  return { kind: 'point', point: h.point };
}
function usable(o) {
  if (o.isSprite || o.isPoints || o.isLine || o.isLineSegments || o.userData.noHit) return false;
  if (o.userData.catId || o.userData.followerOf) return false;
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  if (o.material && o.material.visible === false && !o.userData.product) return false;
  return true;
}
function followerHits() {
  const list = [];
  if (me.myCat) list.push(me.myCat.hit);
  for (const r of remotes.values()) if (r.cat) list.push(r.cat.hit);
  return list;
}

function onTap(x, y) {
  if (!me.entered) return;
  sound.ensure();
  const hit = pick(x, y);
  if (!hit) return;
  if (hit.kind === 'cat') {
    const o = hit.obj;
    if (o.userData.catId) petCat(o.userData.catId);
    else {
      fx.hearts(hit.point, 3);
      sound.purr(3.5);
      ui.toast(o.userData.followerOf === me.name ? '우리 집 고양이가 골골거려요' : `${o.userData.followerOf} 님의 고양이예요`);
    }
    return;
  }
  if (hit.kind === 'product') {
    ui.showProduct(CONFIG.products[hit.key]);
    return;
  }
  // 앉을 자리 근처를 눌렀으면 앉기
  const p = hit.point;
  let best = null, bd = 0.55;
  for (const s of room.seats) {
    const d = Math.hypot(s.pos.x - p.x, s.pos.z - p.z);
    if (d < bd && p.y > 0.05) { bd = d; best = s; }
  }
  // 바닥 방석은 바닥 높이도 허용
  if (!best) for (const s of room.seats) if (s.floor && Math.hypot(s.pos.x - p.x, s.pos.z - p.z) < 0.32) best = s;
  ui.hideCard();
  if (best && best !== me.seat) {
    walkTo(seatApproach(best), { type: 'seat', seat: best });
    ripple(seatApproach(best));
    return;
  }
  const floorPt = new THREE.Vector3(p.x, 0, p.z);
  walkTo(floorPt);
  ripple(me.target);
}

let lastPet = 0;
function petCat(id) {
  const c = cafe.find(id);
  if (!c) return;
  ui.showCat(c.def, () => giveTreat(id));
  if (performance.now() - lastPet < 700) return;
  lastPet = performance.now();
  cafe.pet(id, me.pos.clone(), true);
  net.send({ t: 'pet', id, p: [me.pos.x, me.pos.z] });
  if (!sound.enabled) ui.soundNudge();
  // 너무 멀면 다가가기
  const d = c.pos.clone().setY(0).sub(me.pos);
  if (!me.seat && d.length() > 1.3) {
    const to = c.pos.clone().setY(0).sub(d.normalize().multiplyScalar(0.75));
    walkTo(to, { type: 'faceCat', id });
  } else if (!me.seat) {
    me.yaw = Math.atan2(c.pos.x - me.pos.x, c.pos.z - me.pos.z);
  }
}
let lastTreat = 0;
function giveTreat(id) {
  if (performance.now() - lastTreat < 3500) { ui.toast('천천히, 아직 먹는 중이에요'); return; }
  lastTreat = performance.now();
  cafe.treat(id, me.pos.clone(), true);
  net.send({ t: 'treat', id, p: [me.pos.x, me.pos.z] });
}

// 누른 자리에 동그란 물결
const rippleMesh = new THREE.Mesh(new THREE.RingGeometry(0.14, 0.19, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fff5e0', transparent: true, opacity: 0, depthWrite: false }));
rippleMesh.renderOrder = 5;
scene.add(rippleMesh);
let rippleT = 1;
function ripple(p) { if (!p) return; rippleMesh.position.set(p.x, 0.02, p.z); rippleT = 0; }

// ---------- 조작 ----------
const controls = new Controls(canvas, {
  tap: onTap,
  drag: (dx, dy) => {
    cam.yaw -= dx * 0.0065;
    cam.pitch = THREE.MathUtils.clamp(cam.pitch + dy * 0.004, 0.32, 1.25);
  },
  pinch: (s) => { cam.userZoomed = true; cam.dist = THREE.MathUtils.clamp(cam.dist * s, 5.5, cam.maxDist); },
  wheel: (dy) => { cam.userZoomed = true; cam.dist = THREE.MathUtils.clamp(cam.dist * (1 + dy * 0.001), 5.5, cam.maxDist); },
  holdStart: (x, y) => { if (!me.entered) return; const h = floorAt(x, y); if (h) { me.hold = h; me.target = null; } },
  holdMove: (x, y) => { const h = floorAt(x, y); if (h) me.hold = h; },
  holdEnd: () => { me.hold = null; },
});
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function floorAt(x, y) {
  ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const p = new THREE.Vector3();
  return raycaster.ray.intersectPlane(floorPlane, p) ? p : null;
}

// ---------- 네트워크 ----------
const net = new Net(uid, {
  onHost: (host) => {
    if (host && !cafe.isHost) cafe.adopt();
    cafe.isHost = host;
  },
  onHostLost: () => { /* 방장이 나가면 잠시 고양이를 마지막 위치에 둠 */ },
  onStatus: (s) => ui.setStatus(s),
  onClientOpen: (send) => {
    send({ t: 'cats', c: cafe.snapshot(), uid });
    send(helloMsg());
  },
  onConnected: () => { net.send(helloMsg()); sendState(true); },
  onMessage: (m) => handle(m),
});

function helloMsg() {
  return { t: 'hi', n: me.name, l: me.look, mc: me.myCatInfo ? { ...me.myCatInfo, swatches: undefined } : null, uid };
}
let lastSent = '', lastSentT = 0;
function sendState(force = false) {
  if (!me.entered) return;
  const st = [+me.pos.x.toFixed(2), +me.pos.z.toFixed(2), +me.yaw.toFixed(2)];
  const seatIdx = me.seat ? room.seats.indexOf(me.seat) : -1;
  const c = me.myCat ? me.myCat.state() : null;
  const key = JSON.stringify([st, seatIdx, c]);
  const now = performance.now();
  if (!force && key === lastSent && now - lastSentT < 2000) return;
  lastSent = key; lastSentT = now;
  net.send({ t: 'st', p: st, s: seatIdx, c });
}

function getRemote(id) {
  let r = remotes.get(id);
  if (!r) {
    const avatar = new Avatar('손님', {});
    scene.add(avatar.root);
    r = { avatar, name: '손님', pos: new THREE.Vector3(2.45, 0, 4.2), yaw: Math.PI, tpos: new THREE.Vector3(2.45, 0, 4.2), tyaw: Math.PI, seat: -1, last: performance.now(), cat: null, catKey: '', lookKey: '' };
    remotes.set(id, r);
    ui.setCount(remotes.size + 1);
  }
  r.last = performance.now();
  return r;
}
function dropRemote(id) {
  const r = remotes.get(id);
  if (!r) return;
  scene.remove(r.avatar.root);
  r.cat?.dispose();
  remotes.delete(id);
  ui.setCount(remotes.size + 1);
}

function handle(m) {
  if (!m || !m.t || m.uid === uid) return;
  switch (m.t) {
    case 'cats':
      if (!cafe.isHost) cafe.applySnapshot(m.c);
      break;
    case 'hi': {
      const r = getRemote(m.uid);
      const name = String(m.n || '손님').slice(0, 12);
      const lookKey = JSON.stringify(m.l || {});
      if (lookKey !== r.lookKey || name !== r.name) {
        const fresh = new Avatar(name, sanitizeLook(m.l));
        scene.remove(r.avatar.root);
        r.avatar = fresh;
        scene.add(fresh.root);
        if (!r.lookKey) ui.toast(`${name} 님이 카페에 들어왔어요`);
        r.lookKey = lookKey; r.name = name;
      }
      const ck = JSON.stringify(m.mc || null);
      if (ck !== r.catKey) {
        r.cat?.dispose(); r.cat = null;
        if (m.mc) { r.cat = new FollowerCat(scene, room, sanitizeCat(m.mc), name); }
        r.catKey = ck;
      }
      break;
    }
    case 'st': {
      const r = getRemote(m.uid);
      if (Array.isArray(m.p)) { r.tpos.set(+m.p[0] || 0, 0, +m.p[1] || 0); r.tyaw = +m.p[2] || 0; }
      r.seat = Number.isInteger(m.s) ? m.s : -1;
      if (r.cat && Array.isArray(m.c)) r.cat.setState(m.c);
      break;
    }
    case 'pet': {
      const fromPos = Array.isArray(m.p) ? new THREE.Vector3(m.p[0], 0, m.p[1]) : null;
      cafe.pet(m.id, fromPos, false);
      break;
    }
    case 'treat': {
      const fromPos = Array.isArray(m.p) ? new THREE.Vector3(m.p[0], 0, m.p[1]) : null;
      cafe.treat(m.id, fromPos, false);
      break;
    }
    case 'wave':
      remotes.get(m.uid)?.avatar.wave();
      break;
    case 'bye':
      dropRemote(m.uid);
      break;
  }
}
const isHex = (s) => typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s);
function sanitizeLook(l = {}) {
  return { top: isHex(l.top) ? l.top : LOOKS.tops[0], hair: isHex(l.hair) ? l.hair : LOOKS.hairs[0], skin: isHex(l.skin) ? l.skin : LOOKS.skins[0] };
}
function sanitizeCat(c = {}) {
  const o = {};
  for (const k of ['base', 'dark', 'light', 'orange', 'eye']) o[k] = isHex(c[k]) ? c[k] : undefined;
  o.base ||= '#c8b8a4'; o.dark ||= '#6b5a4c'; o.light ||= '#f4ede2'; o.eye ||= '#b6a443';
  o.stripes = !!c.stripes; o.white = !!c.white; o.patches = !!c.patches;
  o.whiteAmount = Math.max(0, Math.min(1, +c.whiteAmount || 0));
  o.name = String(c.name || '').slice(0, 10);
  return o;
}

function updateRemotes(dt) {
  const now = performance.now();
  for (const [id, r] of remotes) {
    if (now - r.last > 20000) { dropRemote(id); continue; }
    const before = r.pos.clone();
    if (r.pos.distanceTo(r.tpos) > 4) r.pos.copy(r.tpos);
    r.pos.lerp(r.tpos, 1 - Math.exp(-8 * dt));
    r.yaw = dampAngle(r.yaw, r.tyaw, 10, dt);
    const seat = room.seats[r.seat];
    const speed = before.distanceTo(r.pos) / Math.max(dt, 1e-3);
    r.avatar.root.position.copy(r.pos);
    r.avatar.root.position.y = seat ? (seat.pos.y - 0.38) * r.avatar.sitting : 0;
    r.avatar.root.rotation.y = r.yaw;
    r.avatar.update(dt, speed > 0.2 ? speed : 0, !!seat);
    r.cat?.follow(dt);
  }
}

// ---------- 화면 UI 연결 ----------
ui.onEnter = ({ name, look, soundOn }) => {
  me.name = name; me.look = look;
  store.set('name', name); store.set('look', look);
  me.avatar = new Avatar(name, look);
  scene.add(me.avatar.root);
  me.entered = true;
  if (soundOn) { sound.setEnabled(true); sound.setNight(dayNight.target); ui.setSound(true); }
  if (me.myCatInfo) spawnMyCat(me.myCatInfo, false);
  net.start();
  ui.showHint(IS_MOBILE
    ? ['톡 누르면 걸어가요', '끌어서 둘러보고, 두 손가락으로 크게 · 작게', '고양이를 눌러 쓰다듬어 보세요']
    : ['바닥을 누르면 걸어가요 (WASD도 돼요)', '끌어서 둘러보기 · 휠로 크게 · 작게', '고양이를 눌러 쓰다듬어 보세요']);
  walkTo(new THREE.Vector3(2.0, 0, 3.0));
};
ui.onToggleNight = () => {
  dayNight.target = dayNight.target > 0.5 ? 0 : 1;
  sound.setNight(dayNight.target);
  return dayNight.target > 0.5;
};
ui.onToggleSound = () => {
  const on = !sound.enabled;
  sound.setEnabled(on);
  sound.setNight(dayNight.target);
  return on;
};
ui.onWave = () => { me.avatar?.wave(); net.send({ t: 'wave' }); };
ui.onPhoto = async (file) => extractCatColors(file);
ui.onAdoptCat = (info) => {
  me.myCatInfo = info;
  store.set('mycat', { ...info, swatches: undefined });
  spawnMyCat(info, true);
  net.send(helloMsg());
};
ui.onSendHome = () => {
  me.myCat?.dispose(); me.myCat = null; me.myCatInfo = null;
  store.set('mycat', null);
  net.send(helloMsg());
  ui.toast('우리 집 고양이가 집으로 돌아갔어요');
};
ui.getMyCat = () => me.myCatInfo;
function spawnMyCat(info, announce) {
  me.myCat?.dispose();
  me.myCat = new FollowerCat(scene, room, info, me.name);
  if (announce) {
    ui.toast(`${info.name || '우리 고양이'}(이)가 카페에 들어왔어요`);
    setTimeout(() => fx.hearts(me.myCat.model.headWorld(), 4), 600);
  }
}
ui.init({ name: me.name, look: me.look, night: dayNight.target > 0.5 });

// 창을 닫으면 인사
window.addEventListener('pagehide', () => { try { net.send({ t: 'bye' }); } catch { /* 무시 */ } });

// ---------- 네트워크 보내기 (화면이 뒤로 가도 계속 되도록 타이머 사용) ----------
let tick = 0;
setInterval(() => {
  tick++;
  sendState();
  if (cafe.isHost && net.isHost && net.conns.size && tick % 2 === 0) net.send({ t: 'cats', c: cafe.snapshot() });
  if (tick % 25 === 0 && me.entered) net.send(helloMsg());
}, 120);

// ---------- 그리기 반복 ----------
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  updateDayNight(dt, t);
  updateMe(dt);
  cafe.update(dt, t);
  updateRemotes(dt);
  fx.update(dt);
  if (rippleT < 1) {
    rippleT += dt * 1.6;
    rippleMesh.material.opacity = (1 - rippleT) * 0.8;
    rippleMesh.scale.setScalar(1 + rippleT * 1.5);
  } else rippleMesh.material.opacity = 0;
  updateCamera(dt);
  updateWalls(dt);
  // 이름표는 화면 쪽을 보게(스프라이트라 자동), 작은 기울기 보정
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 디버그용 (콘솔에서 window.cafe 로 확인)
window.cafe = { scene, camera, cafe, room, me, net, cam, dayNight, onTap };
