// 고양이서가 카페 실내 (미니어처 디오라마) + 정원은 garden.js
import * as THREE from 'three';
import { M, rbox, mesh, plank, floorTexture, plasterTexture, rugTexture, mulberry, textSprite } from './kit.js';
import { createProduct } from './furniture.js';

// 카페 실내 범위 (m)
export const ROOM = { minX: -8, maxX: 6, minZ: -5.5, maxZ: 5.5, H: 3.0 };
// 실내 + 정원 전체
export const WORLD = { minX: -8, maxX: 20, minZ: -5.5, maxZ: 5.5 };
// 정원으로 나가는 문 (동쪽 벽 x = 6)
export const DOOR = { x: 6, z0: -0.8, z1: 0.8, h: 2.3, inside: new THREE.Vector3(5.3, 0, 0), outside: new THREE.Vector3(6.8, 0, 0) };
const WT = 0.2; // 벽 두께

export function buildRoom(scene) {
  const room = {
    walls: [], seats: [], obstacles: [], products: [], clickables: [],
    nightParts: [], benchSpots: [], gardenSpots: [], boxes: [], update: () => {},
  };
  const rnd = mulberry(42);
  const W = ROOM.maxX - ROOM.minX, D = ROOM.maxZ - ROOM.minZ;
  const cx = (ROOM.minX + ROOM.maxX) / 2;

  // ---------- 받침대 (실내 + 정원 한 판) ----------
  const ww = WORLD.maxX - WORLD.minX, wcx = (WORLD.minX + WORLD.maxX) / 2;
  scene.add(mesh(rbox(ww + 0.9, 0.55, D + 0.9, 0.12, 3), M.woodDark(), wcx, -0.29, 0));
  scene.add(mesh(rbox(ww + 0.7, 0.06, D + 0.7, 0.03), M.color('#f1dcc0', 0.8), wcx, -0.035, 0));
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.62 });
  floorMat.map.repeat.set(W / 4, D / 4);
  const floor = mesh(new THREE.BoxGeometry(W, 0.04, D), floorMat, cx, -0.02, 0, { cast: false });
  floor.name = 'floor';
  scene.add(floor);
  room.floor = floor;

  // ---------- 벽 ----------
  const plaster = new THREE.MeshStandardMaterial({ map: plasterTexture('#f4e8d6'), roughness: 0.95 });
  const shadowOnly = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const lipMat = M.wood();
  // normal: 실내에서 바깥쪽 방향, at: 벽 평면 위치
  function makeWall(name, normal, at, pieces, extra) {
    const g = new THREE.Group();
    g.name = name;
    for (const p of pieces) {
      g.add(mesh(new THREE.BoxGeometry(p.w, p.h, p.d), plaster, p.x, p.y, p.z, { cast: false }));
      const sh = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), shadowOnly);
      sh.position.set(p.x, p.y, p.z);
      sh.castShadow = true;
      sh.userData.noHit = true;
      scene.add(sh);
    }
    if (extra) extra(g);
    g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    scene.add(g);
    // 벽이 내려가도 바닥 둘레에 낮은 턱이 남아 디오라마 테두리가 됨
    const horiz = Math.abs(normal.z) > 0.5;
    const len = horiz ? W + WT * 2 : D;
    const lip = mesh(rbox(horiz ? len : WT, 0.22, horiz ? WT : len, 0.03), lipMat,
      horiz ? cx : at + normal.x * WT / 2, 0.11, horiz ? at + normal.z * WT / 2 : 0, { cast: false });
    lip.userData.noHit = true;
    scene.add(lip);
    g.userData.fade = 1;
    const wall = { group: g, normal, at, opacity: 1 };
    room.walls.push(wall);
    return wall;
  }
  // 창 구멍 뚫린 벽 조각 만들기 (x 방향 벽)
  function piecesX(z, holes, H) {
    const out = [];
    const y0 = 0.85, y1 = 2.45;
    out.push({ w: W + WT * 2, h: y0, d: WT, x: cx, y: y0 / 2, z });
    out.push({ w: W + WT * 2, h: H - y1, d: WT, x: cx, y: (H + y1) / 2, z });
    let s = ROOM.minX - WT;
    for (const [a, b] of [...holes, [ROOM.maxX + WT, ROOM.maxX + WT]]) {
      if (a > s) out.push({ w: a - s, h: y1 - y0, d: WT, x: (s + a) / 2, y: (y0 + y1) / 2, z });
      s = b;
    }
    return out;
  }

  const H = ROOM.H;
  const winA = [-4.4, -1.6], winB = [0.2, 3.0];
  makeWall('backWall', new THREE.Vector3(0, 0, -1), ROOM.minZ, piecesX(ROOM.minZ - WT / 2, [winA, winB], H), (g) => {
    wainscot(g, 'x', ROOM.minZ + 0.012, ROOM.minX, ROOM.maxX, [[winA[0] - 0.1, winA[1] + 0.1], [winB[0] - 0.1, winB[1] + 0.1]]);
    windowFrame(g, winA[0], winA[1], 0.85, 2.45, ROOM.minZ);
    windowFrame(g, winB[0], winB[1], 0.85, 2.45, ROOM.minZ);
    room.outsideView = outside(g, room);
    stringLights(g, room, [[-7.8, -4.7], [3.3, 5.8]]);
    signBoard(g, -0.7);
    wallShelfWithPlants(g, 4.85, 2.25);
  });
  makeWall('leftWall', new THREE.Vector3(-1, 0, 0), ROOM.minX, [
    { w: WT, h: H, d: D + WT * 2, x: ROOM.minX - WT / 2, y: H / 2, z: 0 },
  ], (g) => {
    wainscot(g, 'z', ROOM.minX + 0.012, ROOM.minZ, ROOM.maxZ, []);
    catPicture(g, ROOM.minX + 0.02, 2.25, 1.4, Math.PI / 2, '#f0c27a', 0);
    catPicture(g, ROOM.minX + 0.02, 2.3, 2.4, Math.PI / 2, '#b9d1c2', 1);
  });
  // 동쪽 벽: 정원으로 나가는 문
  const ex = ROOM.maxX + WT / 2;
  makeWall('eastWall', new THREE.Vector3(1, 0, 0), ROOM.maxX, [
    { w: WT, h: H, d: DOOR.z0 - ROOM.minZ + WT, x: ex, y: H / 2, z: (ROOM.minZ - WT + DOOR.z0) / 2 },
    { w: WT, h: H, d: ROOM.maxZ + WT - DOOR.z1, x: ex, y: H / 2, z: (DOOR.z1 + ROOM.maxZ + WT) / 2 },
    { w: WT, h: H - DOOR.h, d: DOOR.z1 - DOOR.z0, x: ex, y: (H + DOOR.h) / 2, z: 0 },
  ], (g) => {
    wainscot(g, 'z', ROOM.maxX - 0.012, ROOM.minZ, ROOM.maxZ, [[DOOR.z0 - 0.12, DOOR.z1 + 0.12]]);
    catPicture(g, ROOM.maxX - 0.02, 2.0, 2.6, -Math.PI / 2, '#e9b4a0', 2);
    catPicture(g, ROOM.maxX - 0.02, 2.15, 3.75, -Math.PI / 2, '#c8d6e8', 3);
    wallClock(g, ROOM.maxX - 0.03, 2.3, -2.0);
    // 바깥쪽 처마 등
    const lamp = mesh(new THREE.SphereGeometry(0.09, 12, 10), new THREE.MeshStandardMaterial({ color: '#fff0c8', emissive: '#ffcf7a', emissiveIntensity: 0.2 }), ROOM.maxX + WT + 0.12, 2.55, 1.15, { cast: false });
    g.add(lamp);
    room.nightParts.push((dt, t, n) => { lamp.material.emissiveIntensity = 0.2 + n * 1.6; });
  });
  room.gardenDoor = gardenDoor(scene, room);
  // 앞 벽 (입구)
  const fd0 = -2.2, fd1 = -1.1, fdh = 2.2;
  const fz = ROOM.maxZ + WT / 2;
  makeWall('frontWall', new THREE.Vector3(0, 0, 1), ROOM.maxZ, [
    { w: fd0 - ROOM.minX + WT, h: H, d: WT, x: (ROOM.minX - WT + fd0) / 2, y: H / 2, z: fz },
    { w: ROOM.maxX + WT - fd1, h: H, d: WT, x: (fd1 + ROOM.maxX + WT) / 2, y: H / 2, z: fz },
    { w: fd1 - fd0, h: H - fdh, d: WT, x: (fd0 + fd1) / 2, y: (H + fdh) / 2, z: fz },
  ], (g) => {
    wainscot(g, 'x', ROOM.maxZ - 0.012, ROOM.minX, ROOM.maxX, [[fd0, fd1]]);
    door(g, fd0, fd1, fdh);
  });
  room.walls.forEach((w) => { w.isCafe = true; });
  // 문 옆 벽은 장애물 (정원 문만 지나갈 수 있음)
  room.obstacles.push(
    { minX: ROOM.maxX - 0.05, maxX: ROOM.maxX + WT + 0.05, minZ: ROOM.minZ - 1, maxZ: DOOR.z0, wall: true },
    { minX: ROOM.maxX - 0.05, maxX: ROOM.maxX + WT + 0.05, minZ: DOOR.z1, maxZ: ROOM.maxZ + 1, wall: true },
  );

  // ---------- 제품 캣타워 ----------
  const ormi = createProduct('ormi', { x: 4.6, z: ROOM.minZ + 0.3, rotY: 0 });
  const customB = createProduct('customB', { x: ROOM.minX + 0.3, z: -1.6, rotY: Math.PI / 2 });
  for (const p of [ormi, customB]) {
    scene.add(p.root);
    room.products.push(p);
    room.clickables.push(p.hit);
    room.obstacles.push(p.obstacle);
    room.boxes.push(...p.boxes.map((b, i) => ({ ...b, key: `${p.key}:box${i}`, product: p.key })));
  }

  // ---------- 창가 벤치 (창 A) ----------
  {
    const bx = (winA[0] + winA[1]) / 2;
    const g = new THREE.Group();
    g.position.set(bx, 0, ROOM.minZ + 0.3);
    plank(g, 3.0, 0.38, 0.58, 0, 0.19, 0, M.woodMid(), 0.03);
    plank(g, 3.06, 0.05, 0.62, 0, 0.405, 0, M.wood(), 0.02);
    g.add(mesh(rbox(2.9, 0.1, 0.52, 0.05, 3), M.fabric('#e3c79a'), 0, 0.48, 0.01));
    for (let i = 0; i < 3; i++) {
      const pill = mesh(rbox(0.42, 0.32, 0.13, 0.06, 3), M.fabric(['#c98f6b', '#a9bba0', '#efe0c7'][i]), -1.05 + i * 1.05 + (i === 1 ? 0.15 : 0), 0.66, -0.2);
      pill.rotation.x = -0.18;
      g.add(pill);
    }
    for (const b of [-0.8, 0.8]) g.add(mesh(rbox(0.6, 0.26, 0.4, 0.04), M.color('#c7a06b', 1), b, 0.16, 0.12));
    scene.add(g);
    room.obstacles.push({ minX: bx - 1.55, maxX: bx + 1.55, minZ: ROOM.minZ, maxZ: ROOM.minZ + 0.62 });
    room.seats.push(seat(bx - 0.7, 0.53, ROOM.minZ + 0.42, 0), seat(bx + 0.75, 0.53, ROOM.minZ + 0.42, 0));
    room.benchSpots.push(new THREE.Vector3(bx - 0.15, 0.53, ROOM.minZ + 0.38), new THREE.Vector3(bx + 1.25, 0.53, ROOM.minZ + 0.38));
  }
  // ---------- 창가 바 좌석 (창 B) ----------
  windowBar(scene, room, (winB[0] + winB[1]) / 2);

  // ---------- 서가 ----------
  bookshelf(scene, room, -6.35, ROOM.minZ + 0.2, rnd);

  // ---------- 카페 테이블 (2인석) ----------
  const tableCols = ['#e7c58e', '#a9bba0', '#d79a7c', '#c9b6e4', '#9fb7c9'];
  [[-4.7, -2.3], [-2.0, -2.3], [0.7, -2.3], [-3.35, 0.4], [-0.65, 0.4]].forEach(([x, z], i) => cafeTable(scene, room, x, z, tableCols[i]));

  // ---------- 라운지: 소파 + 찻상 + 러그 ----------
  sofa(scene, room, ROOM.maxX - 0.5, 3.15, -Math.PI / 2, '#a7b996');
  sofa(scene, room, 2.15, ROOM.maxZ - 0.5, Math.PI, '#d6a585', 1.9);
  scene.add(mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.015, 48), new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 1 }), 3.55, 0.008, 3.35, { cast: false }));
  coffeeTable(scene, room, 3.75, 3.35);
  floorLamp(scene, room, ROOM.maxX - 0.42, ROOM.maxZ - 0.42);
  woodStove(scene, room, ROOM.maxX - 0.55, -3.3);

  // ---------- 좌식 공간 ----------
  teaCorner(scene, room, -5.9, 2.55);

  // ---------- 주문 카운터 ----------
  counter(scene, room, -5.9, ROOM.maxZ - 0.45);
  room.orderSpot = new THREE.Vector3(-5.9, 0, ROOM.maxZ - 1.45);

  // ---------- 화분 · 고양이 밥 ----------
  plant(scene, room, -1.0, ROOM.minZ + 0.35, 0.9, rnd);
  plant(scene, room, 3.6, ROOM.minZ + 0.35, 0.8, rnd);
  plant(scene, room, ROOM.maxX - 0.4, DOOR.z1 + 0.45, 1.0, rnd);
  plant(scene, room, ROOM.maxX - 0.4, DOOR.z0 - 0.45, 0.85, rnd);
  plant(scene, room, -0.3, ROOM.maxZ - 0.4, 0.75, rnd);
  plant(scene, room, ROOM.minX + 0.4, ROOM.maxZ - 1.4, 1.1, rnd);
  {
    const mat = M.color('#f5efe6', 0.4);
    const bz0 = ROOM.minZ + 1.0, bx0 = -0.2;
    for (const [bx, c] of [[0, '#d48a5a'], [0.35, '#8fbcd4']]) {
      scene.add(mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.06, 20), mat, bx0 + bx, 0.03, bz0));
      scene.add(mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.01, 20), M.color(c, 0.5), bx0 + bx, 0.058, bz0, { cast: false }));
    }
    scene.add(mesh(rbox(0.75, 0.012, 0.36, 0.05), M.color('#e9b6a6', 1), bx0 + 0.17, 0.006, bz0, { cast: false }));
    room.foodSpot = new THREE.Vector3(bx0 + 0.17, 0, bz0 + 0.35);
  }
  scene.add(mesh(new THREE.SphereGeometry(0.06, 14, 10), M.color('#f1c45b', 1), 1.4, 0.06, 1.6));

  room.spawn = new THREE.Vector3((fd0 + fd1) / 2, 0, ROOM.maxZ - 0.9);
  room.update = (dt, t, night) => {
    for (const fn of room.nightParts) fn(dt, t, night);
  };
  return room;

  function seat(x, y, z, rotY) { return { pos: new THREE.Vector3(x, y, z), rotY, taken: null }; }
}

function seatLocal(root, lx, ly, lz, rotOffset = 0) {
  root.updateMatrixWorld(true);
  const p = root.localToWorld(new THREE.Vector3(lx, ly, lz));
  return { pos: p, rotY: root.rotation.y + rotOffset, taken: null };
}

// 아래 판벽 (웨인스코팅)
function wainscot(g, axis, at, a0, a1, gaps) {
  const h = 0.95;
  const segs = [];
  let start = a0;
  for (const [g0, g1] of gaps.sort((p, q) => p[0] - q[0])) {
    if (g0 > start) segs.push([start, g0]);
    start = g1;
  }
  if (a1 > start) segs.push([start, a1]);
  const mat = M.woodLight();
  const cap = M.wood();
  const inward = axis === 'x' ? Math.sign(-at) : Math.sign(-at);
  for (const [s0, s1] of segs) {
    const len = s1 - s0, mid = (s0 + s1) / 2;
    const off = 0.015 * inward;
    if (axis === 'x') {
      g.add(mesh(new THREE.BoxGeometry(len, h, 0.03), mat, mid, h / 2, at + off, { cast: false }));
      g.add(mesh(rbox(len, 0.05, 0.07, 0.02), cap, mid, h + 0.02, at + off * 2, { cast: false }));
      g.add(mesh(rbox(len, 0.12, 0.05, 0.015), M.woodMid(), mid, 0.06, at + off * 2, { cast: false }));
      for (let x = s0 + 0.35; x < s1 - 0.1; x += 0.7) {
        g.add(mesh(rbox(0.02, h - 0.25, 0.02, 0.008), cap, x, h / 2 + 0.05, at + off * 2.2, { cast: false }));
      }
    } else {
      g.add(mesh(new THREE.BoxGeometry(0.03, h, len), mat, at + off, h / 2, mid, { cast: false }));
      g.add(mesh(rbox(0.07, 0.05, len, 0.02), cap, at + off * 2, h + 0.02, mid, { cast: false }));
      g.add(mesh(rbox(0.05, 0.12, len, 0.015), M.woodMid(), at + off * 2, 0.06, mid, { cast: false }));
      for (let z = s0 + 0.35; z < s1 - 0.1; z += 0.7) {
        g.add(mesh(rbox(0.02, h - 0.25, 0.02, 0.008), cap, at + off * 2.2, h / 2 + 0.05, z, { cast: false }));
      }
    }
  }
}

function windowFrame(g, x0, x1, y0, y1, z) {
  const mat = M.wood();
  const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const f = 0.09;
  g.add(mesh(rbox(w + f * 2, f, 0.24, 0.025), mat, cx, y1 + f / 2, z));
  g.add(mesh(rbox(w + f * 2 + 0.1, f * 0.8, 0.32, 0.025), mat, cx, y0 - f * 0.4, z + 0.05));
  g.add(mesh(rbox(f, h, 0.24, 0.025), mat, x0 - f / 2, cy, z));
  g.add(mesh(rbox(f, h, 0.24, 0.025), mat, x1 + f / 2, cy, z));
  // 창살
  g.add(mesh(rbox(0.045, h, 0.06, 0.012), mat, cx, cy, z - 0.05));
  g.add(mesh(rbox(w, 0.045, 0.06, 0.012), mat, cx, cy + 0.15, z - 0.05));
  // 커튼
  const curtain = M.fabric('#f0d9b5');
  for (const sx of [-1, 1]) {
    const c = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const fold = mesh(new THREE.CylinderGeometry(0.07, 0.09, h + 0.35, 10), curtain, sx * (i * 0.1), 0, Math.sin(i * 1.7) * 0.02);
      fold.scale.z = 0.5;
      c.add(fold);
    }
    c.position.set(sx < 0 ? x0 - 0.18 : x1 + 0.18, cy + 0.05, z + 0.18);
    c.scale.x = -sx;
    g.add(c);
  }
  g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, w + 1.0, 10).rotateZ(Math.PI / 2), M.woodDark(), cx, y1 + 0.22, z + 0.2));
  // 유리 (아주 옅게)
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: '#dfeff5', transparent: true, opacity: 0.12, roughness: 0.05 }));
  glass.position.set(cx, cy, z - 0.07);
  g.add(glass);
}

// 창밖: 하늘, 언덕, 나무, 별, 달, 비
function outside(parent, room) {
  const g = new THREE.Group();
  g.position.x = -0.7;
  parent.add(g);
  const mk = (draw) => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    draw(c.getContext('2d'));
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  const dayTex = mk((x) => {
    const gr = x.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#a9cde0'); gr.addColorStop(0.6, '#e8e3d3'); gr.addColorStop(1, '#f5dcc0');
    x.fillStyle = gr; x.fillRect(0, 0, 512, 256);
    x.fillStyle = 'rgba(255,255,255,0.7)';
    for (const [cx, cy, s] of [[90, 60, 1], [330, 45, 1.3], [450, 90, 0.8]]) {
      for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(cx + i * 18 * s, cy + Math.sin(i) * 6, 20 * s, 0, 7); x.fill(); }
    }
  });
  const nightTex = mk((x) => {
    const gr = x.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#0e1430'); gr.addColorStop(0.7, '#27305a'); gr.addColorStop(1, '#4b4670');
    x.fillStyle = gr; x.fillRect(0, 0, 512, 256);
  });
  const zz = ROOM.minZ - 1.9;
  const skyDay = new THREE.Mesh(new THREE.PlaneGeometry(13, 5), new THREE.MeshBasicMaterial({ map: dayTex, fog: false }));
  skyDay.position.set(0, 2, zz);
  const skyNight = new THREE.Mesh(new THREE.PlaneGeometry(13, 5), new THREE.MeshBasicMaterial({ map: nightTex, transparent: true, opacity: 0, fog: false }));
  skyNight.position.set(0, 2, zz + 0.01);
  g.add(skyDay, skyNight);
  // 언덕
  const hillMat = new THREE.MeshStandardMaterial({ color: '#a8bf8e', roughness: 1 });
  for (const [hx, hr, hz] of [[-3.5, 2.4, -1.2], [3.6, 2.0, -1.0], [0.3, 2.8, -1.5], [-1.4, 2.2, -0.8]]) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(hr, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), hillMat);
    h.scale.y = 0.35; h.position.set(hx, -0.2, ROOM.minZ - 0.6 + hz);
    g.add(h);
  }
  // 나무
  const leaf = new THREE.MeshStandardMaterial({ color: '#7fa36d', roughness: 1 });
  const trunk = M.color('#8b6a4a');
  for (const [tx, tz, s] of [[-3.1, -0.7, 1], [-1.0, -0.9, 1.25], [0.6, -1.3, 0.8], [2.4, -0.6, 0.7], [3.4, -0.8, 1.1], [-2.2, -1.2, 0.8]]) {
    const t = new THREE.Group();
    t.add(mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.6, 8), trunk, 0, 0.3, 0));
    t.add(mesh(new THREE.ConeGeometry(0.38, 0.7, 10), leaf, 0, 0.8, 0));
    t.add(mesh(new THREE.ConeGeometry(0.3, 0.6, 10), leaf, 0, 1.12, 0));
    t.scale.setScalar(s);
    t.position.set(tx, 0.3, ROOM.minZ - 0.25 + tz);
    g.add(t);
  }
  // 별
  const starGeo = new THREE.BufferGeometry();
  const pts = [];
  const r = mulberry(5);
  for (let i = 0; i < 90; i++) pts.push((r() - 0.5) * 12, 1.6 + r() * 2.8, zz + 0.05);
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const starMat = new THREE.PointsMaterial({ color: '#fff6d8', size: 0.05, transparent: true, opacity: 0, fog: false });
  const stars = new THREE.Points(starGeo, starMat);
  g.add(stars);
  const moon = new THREE.Mesh(new THREE.CircleGeometry(0.22, 24), new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0, fog: false }));
  moon.position.set(2.3, 2.25, zz + 0.06);
  g.add(moon);
  // 비
  const N = 140;
  const rainGeo = new THREE.BufferGeometry();
  const rp = new Float32Array(N * 6);
  const speeds = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const x = (r() - 0.5) * 8, y = r() * 3.4, z = ROOM.minZ - 0.35 - r() * 1.4;
    rp.set([x, y, z, x - 0.02, y - 0.16, z], i * 6);
    speeds[i] = 3 + r() * 2;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  const rainMat = new THREE.LineBasicMaterial({ color: '#c7d6e6', transparent: true, opacity: 0.45 });
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false;
  g.add(rain);

  room.nightParts.push((dt, t, night) => {
    skyNight.material.opacity = night;
    hillMat.color.setStyle('#a8bf8e').lerp(new THREE.Color('#2f3b4a'), night);
    leaf.color.setStyle('#7fa36d').lerp(new THREE.Color('#25333a'), night);
    starMat.opacity = night * (0.75 + Math.sin(t * 2) * 0.15) * parent.userData.fade;
    moon.material.opacity = night * parent.userData.fade;
    rain.visible = !!room.rainOn;
    rainMat.opacity = 0.45 * parent.userData.fade;
    const a = rainGeo.attributes.position.array;
    for (let i = 0; i < N; i++) {
      const dy = speeds[i] * dt;
      a[i * 6 + 1] -= dy; a[i * 6 + 4] -= dy;
      if (a[i * 6 + 4] < -0.2) { a[i * 6 + 1] += 3.6; a[i * 6 + 4] += 3.6; }
    }
    rainGeo.attributes.position.needsUpdate = true;
  });
  parent.userData.fade = 1;
  return g;
}

function stringLights(g, room, segs) {
  const bulbs = [];
  const wire = [];
  const z = ROOM.minZ + 0.04;
  const colors = ['#ffd27a', '#ffb37a', '#fff0b8'];
  for (const [a, b] of segs) {
    const n = 11;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = a + (b - a) * t;
      const y = 2.78 - Math.sin(t * Math.PI) * 0.28;
      wire.push(new THREE.Vector3(x, y, z));
      if (i > 0 && i < n) {
        const m = new THREE.MeshStandardMaterial({ color: colors[i % 3], emissive: colors[i % 3], emissiveIntensity: 0.2, roughness: 0.4 });
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), m);
        bulb.position.set(x, y - 0.06, z + 0.02);
        g.add(bulb);
        bulbs.push(m);
      }
    }
    const curve = new THREE.CatmullRomCurve3(wire.splice(0));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.006, 4), M.color('#5a4636')));
  }
  room.nightParts.push((dt, t, night) => {
    bulbs.forEach((m, i) => { m.emissiveIntensity = 0.15 + night * (1.6 + Math.sin(t * 1.3 + i) * 0.25); });
  });
}

function signBoard(g, sx = 0) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  const x = c.getContext('2d');
  x.fillStyle = '#7a5134'; x.beginPath(); x.roundRect(0, 0, 512, 160, 40); x.fill();
  x.fillStyle = '#f7e6c8';
  x.font = '700 70px "Jua", "Gowun Dodum", sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('고양이서가', 256, 70);
  x.font = '600 30px "Gowun Dodum", sans-serif';
  x.fillText('· CAT CAFÉ ·', 256, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.4), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.8 }));
  m.position.set(sx, 2.72, ROOM.minZ + 0.03);
  g.add(m);
  // 폰트가 늦게 로드되면 다시 그림
  document.fonts?.ready.then(() => {
    x.clearRect(0, 0, 512, 160);
    x.fillStyle = '#7a5134'; x.beginPath(); x.roundRect(0, 0, 512, 160, 40); x.fill();
    x.fillStyle = '#f7e6c8';
    x.font = '700 70px "Jua", "Gowun Dodum", sans-serif';
    x.fillText('고양이서가', 256, 70);
    x.font = '600 30px "Gowun Dodum", sans-serif';
    x.fillText('· CAT CAFÉ ·', 256, 128);
    t.needsUpdate = true;
  });
}

function wallShelfWithPlants(g, x, y) {
  const z = ROOM.minZ + 0.14;
  g.add(mesh(rbox(1.3, 0.04, 0.24, 0.015), M.wood(), x, y, z));
  for (const sx of [-0.5, 0.5]) g.add(mesh(rbox(0.03, 0.14, 0.18, 0.01), M.woodMid(), x + sx, y - 0.09, z - 0.02));
  const pot = M.color('#d98f6f', 0.9);
  for (const [px, s] of [[-0.4, 1], [0.05, 0.8], [0.42, 1.1]]) {
    g.add(mesh(new THREE.CylinderGeometry(0.07 * s, 0.055 * s, 0.11 * s, 14), pot, x + px, y + 0.075 * s, z));
    for (let i = 0; i < 5; i++) {
      const l = mesh(new THREE.SphereGeometry(0.05 * s, 10, 8), M.color(i % 2 ? '#7fae74' : '#93c084', 1), x + px + Math.cos(i * 1.3) * 0.04, y + 0.17 * s + (i % 3) * 0.03, z + Math.sin(i * 1.3) * 0.04);
      g.add(l);
    }
  }
  // 늘어지는 덩굴
  for (let i = 0; i < 6; i++) g.add(mesh(new THREE.SphereGeometry(0.03, 8, 6), M.color('#86b479', 1), x + 0.42 + Math.sin(i) * 0.03, y - 0.04 - i * 0.07, z + 0.06));
}

function catPicture(g, x, y, z, rotY, bg, kind) {
  const c = document.createElement('canvas'); c.width = 200; c.height = 240;
  const p = c.getContext('2d');
  p.fillStyle = bg; p.fillRect(0, 0, 200, 240);
  p.fillStyle = ['#5a3e2e', '#3c4a42', '#6b3f35', '#3b4660'][kind];
  // 앉은 고양이 실루엣
  p.beginPath(); p.ellipse(100, 170, 52, 50, 0, 0, 7); p.fill();
  p.beginPath(); p.arc(100, 102, 36, 0, 7); p.fill();
  p.beginPath(); p.moveTo(70, 86); p.lineTo(74, 50); p.lineTo(94, 72); p.fill();
  p.beginPath(); p.moveTo(130, 86); p.lineTo(126, 50); p.lineTo(106, 72); p.fill();
  p.lineWidth = 12; p.lineCap = 'round'; p.strokeStyle = p.fillStyle;
  p.beginPath(); p.moveTo(150, 205); p.quadraticCurveTo(190, 190, 172, 140); p.stroke();
  if (kind % 2) { p.fillStyle = '#fff6e0'; p.beginPath(); p.arc(150, 50, 18, 0, 7); p.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const fr = new THREE.Group();
  fr.add(mesh(rbox(0.5, 0.6, 0.04, 0.015), M.woodMid(), 0, 0, 0, { cast: false }));
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.48), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
  pic.position.z = 0.022;
  fr.add(pic);
  fr.position.set(x, y, z);
  fr.rotation.y = rotY;
  g.add(fr);
}

function wallClock(g, x, y, z) {
  const c = new THREE.Group();
  c.add(mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 32).rotateX(Math.PI / 2), M.woodMid(), 0, 0, 0, { cast: false }));
  c.add(mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.02, 32).rotateX(Math.PI / 2), M.color('#fbf3e4'), 0, 0, 0.022, { cast: false }));
  const handM = M.color('#4a3426');
  const h1 = mesh(rbox(0.016, 0.1, 0.01, 0.004), handM, 0, 0.04, 0.036, { cast: false });
  const h2 = mesh(rbox(0.012, 0.15, 0.01, 0.004), handM, 0.03, 0.03, 0.04, { cast: false });
  h1.rotation.z = 0.8; h2.rotation.z = -0.4;
  c.add(h1, h2);
  // 귀
  for (const s of [-1, 1]) {
    const e = mesh(new THREE.ConeGeometry(0.07, 0.11, 4), M.woodMid(), s * 0.13, 0.2, 0, { cast: false });
    e.rotation.z = -s * 0.4;
    c.add(e);
  }
  c.position.set(x, y, z);
  c.rotation.y = -Math.PI / 2;
  g.add(c);
}

function door(g, x0, x1, h) {
  const z = ROOM.maxZ - 0.02;
  const w = x1 - x0, cx = (x0 + x1) / 2;
  const fm = M.wood();
  g.add(mesh(rbox(0.08, h, 0.2, 0.02), fm, x0 - 0.04, h / 2, z));
  g.add(mesh(rbox(0.08, h, 0.2, 0.02), fm, x1 + 0.04, h / 2, z));
  g.add(mesh(rbox(w + 0.16, 0.08, 0.2, 0.02), fm, cx, h + 0.04, z));
  const d = mesh(rbox(w - 0.02, h - 0.02, 0.06, 0.02), M.woodMid(), cx, h / 2, z + 0.04);
  g.add(d);
  const glass = mesh(rbox(w - 0.4, 0.7, 0.01, 0.1), M.color('#d6e7ee', 0.1, { transparent: true, opacity: 0.6 }), cx, h * 0.7, z - 0.0);
  g.add(glass);
  g.add(mesh(new THREE.SphereGeometry(0.04, 12, 8), M.color('#c9a24a', 0.3, { metalness: 0.6 }), x0 + 0.15, 1.0, z - 0.02));
  // 현관 매트
  const mat = mesh(rbox(1.1, 0.02, 0.6, 0.04), M.fabric('#c7865e'), cx, 0.01, ROOM.maxZ - 0.4, { cast: false });
  g.add(mat);
}

function bookshelf(scene, room, cx, z, rnd) {
  const g = new THREE.Group();
  const W = 2.6, H = 2.2, D = 0.36;
  const wm = M.wood();
  plank(g, 0.05, H, D, -W / 2, H / 2, 0, wm, 0.015);
  plank(g, 0.05, H, D, W / 2, H / 2, 0, wm, 0.015);
  plank(g, W / 2 - 0.02, H - 0.1, 0.04, 0, H / 2, -D / 2 + 0.02, M.woodLight(), 0.01);
  plank(g, W + 0.06, 0.05, D + 0.02, 0, H, 0, wm, 0.015);
  const shelves = [0.06, 0.6, 1.12, 1.64];
  const bookCols = ['#b65d4c', '#d79c5c', '#5f7f6e', '#e4cfa3', '#7a8bb0', '#9e6b52', '#c9b27a', '#4e6a7b', '#d7b6a5', '#8a9a62'];
  for (const sy of shelves) {
    plank(g, W - 0.04, 0.04, D - 0.02, 0, sy, 0, wm, 0.012);
    let x = -W / 2 + 0.07;
    let n = 0;
    while (x < W / 2 - 0.2) {
      if (rnd() < 0.12 && n > 2) {
        // 소품 자리 (화분 / 고양이 인형 / 빈칸)
        const k = Math.floor(rnd() * 3);
        if (k === 0) {
          g.add(mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.12, 12), M.color('#e0a07c'), x + 0.1, sy + 0.08, 0.02));
          g.add(mesh(new THREE.SphereGeometry(0.09, 10, 8), M.color('#86b479', 1), x + 0.1, sy + 0.2, 0.02));
        } else if (k === 1) {
          const cat = mesh(new THREE.SphereGeometry(0.07, 12, 10), M.color('#f2e6d6', 0.6), x + 0.1, sy + 0.09, 0.03);
          cat.scale.y = 1.2; g.add(cat);
          const head = mesh(new THREE.SphereGeometry(0.05, 12, 10), M.color('#f2e6d6', 0.6), x + 0.1, sy + 0.2, 0.04);
          g.add(head);
          for (const s of [-1, 1]) g.add(mesh(new THREE.ConeGeometry(0.018, 0.04, 6), M.color('#f2e6d6', 0.6), x + 0.1 + s * 0.028, sy + 0.25, 0.04));
        }
        x += 0.24;
        n = 0;
        continue;
      }
      const bw = 0.04 + rnd() * 0.045;
      const bh = 0.3 + rnd() * 0.16;
      const tilt = rnd() < 0.08 ? 0.25 : 0;
      const b = mesh(rbox(bw, bh, 0.24 + rnd() * 0.06, 0.008), M.color(bookCols[Math.floor(rnd() * bookCols.length)], 0.8), x + bw / 2, sy + 0.02 + bh / 2, 0.02);
      b.rotation.z = tilt;
      g.add(b);
      x += bw + 0.004 + tilt * 0.1;
      n++;
    }
  }
  g.position.set(cx, 0, z);
  scene.add(g);
  room.obstacles.push({ minX: cx - W / 2 - 0.05, maxX: cx + W / 2 + 0.05, minZ: z - D / 2, maxZ: z + D / 2 + 0.05 });
}

function sofa(scene, room, x, z, rotY = -Math.PI / 2, color = '#a7b996', L = 2.3) {
  const g = new THREE.Group();
  const fab = M.fabric(color);
  const fab2 = M.fabric(new THREE.Color(color).offsetHSL(0, 0, -0.05).getStyle());
  const D = 0.9;
  plank(g, L, 0.3, D, 0, 0.25, 0, fab2, 0.08);                       // 몸통
  plank(g, L, 0.55, 0.24, 0, 0.62, -D / 2 + 0.12, fab2, 0.1);         // 등받이
  for (const s of [-1, 1]) plank(g, 0.22, 0.42, D, s * (L / 2 - 0.11), 0.48, 0, fab2, 0.1); // 팔걸이
  for (const s of [-1, 1]) {
    const c = mesh(rbox(L / 2 - 0.24, 0.15, D - 0.3, 0.07, 3), fab, s * (L / 4 - 0.06), 0.47, 0.08);
    g.add(c);
    const back = mesh(rbox(L / 2 - 0.28, 0.42, 0.16, 0.08, 3), fab, s * (L / 4 - 0.06), 0.78, -D / 2 + 0.3);
    back.rotation.x = -0.15;
    g.add(back);
  }
  // 쿠션
  const pill = mesh(rbox(0.38, 0.34, 0.12, 0.06, 3), M.fabric('#e7c58e'), -0.75, 0.68, -0.08);
  pill.rotation.set(-0.3, 0.2, 0.15);
  g.add(pill);
  // 담요
  const blanket = mesh(rbox(0.5, 0.05, D - 0.1, 0.025), M.fabric('#d79a7c'), 0.86, 0.72, 0.04);
  blanket.rotation.z = 0.1;
  g.add(blanket);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(mesh(new THREE.CylinderGeometry(0.03, 0.022, 0.1, 8), M.woodDark(), sx * (L / 2 - 0.1), 0.05, sz * (D / 2 - 0.1)));
  }
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  scene.add(g);
  const along = Math.abs(Math.sin(rotY)) > 0.5;
  const hx = along ? D / 2 : L / 2, hz = along ? L / 2 : D / 2;
  room.obstacles.push({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
  room.seats.push(seatLocal(g, -L * 0.22, 0.54, 0.12), seatLocal(g, L * 0.22, 0.54, 0.12));
  room.benchSpots.push(g.localToWorld(new THREE.Vector3(0, 0.55, 0.1)), g.localToWorld(new THREE.Vector3(L / 2 - 0.2, 0.75, 0.0)));
}

function coffeeTable(scene, room, x, z) {
  const g = new THREE.Group();
  const W = 0.62, L = 1.15, Hh = 0.42;
  plank(g, W, 0.05, L, 0, Hh - 0.025, 0, M.wood(), 0.02);
  plank(g, W - 0.08, 0.03, L - 0.1, 0, 0.12, 0, M.woodLight(), 0.012);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) plank(g, 0.05, Hh - 0.05, 0.05, sx * (W / 2 - 0.05), (Hh - 0.05) / 2, sz * (L / 2 - 0.06), M.woodMid(), 0.012);
  // 다기 세트
  teaSet(g, 0, Hh, 0.05);
  // 책 한 권
  const book = mesh(rbox(0.2, 0.04, 0.28, 0.008), M.color('#b65d4c'), 0.12, Hh + 0.02, -0.36);
  book.rotation.y = 0.3;
  g.add(book);
  g.add(mesh(rbox(0.19, 0.035, 0.27, 0.008), M.color('#f2ead9'), 0.12, Hh + 0.055, -0.36).rotateY(0.25));
  // 아래 칸 바구니
  g.add(mesh(rbox(0.3, 0.12, 0.35, 0.03), M.color('#c7a06b', 1), 0, 0.2, 0.25));
  g.position.set(x, 0, z);
  scene.add(g);
  room.obstacles.push({ minX: x - W / 2, maxX: x + W / 2, minZ: z - L / 2, maxZ: z + L / 2 });
}

function teaSet(g, x, y, z) {
  const cer = M.color('#f6efe4', 0.35);
  const accent = M.color('#7ea296', 0.4);
  const pot = mesh(new THREE.SphereGeometry(0.08, 18, 12), cer, x, y + 0.07, z);
  pot.scale.y = 0.85;
  g.add(pot);
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.03, 12), accent, x, y + 0.14, z));
  g.add(mesh(new THREE.SphereGeometry(0.014, 8, 6), accent, x, y + 0.165, z));
  const spout = mesh(new THREE.CylinderGeometry(0.01, 0.018, 0.08, 8), cer, x + 0.09, y + 0.08, z);
  spout.rotation.z = -0.9; g.add(spout);
  const handle = mesh(new THREE.TorusGeometry(0.035, 0.009, 6, 14, Math.PI * 1.2), cer, x - 0.085, y + 0.075, z);
  handle.rotation.z = Math.PI * 0.4; g.add(handle);
  for (const [cx, cz] of [[0.12, 0.2], [-0.13, 0.22]]) {
    g.add(mesh(new THREE.CylinderGeometry(0.035, 0.026, 0.05, 14), cer, x + cx, y + 0.025, z + cz));
    g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.005, 14), M.color('#b27c4c', 0.2), x + cx, y + 0.046, z + cz, { cast: false }));
  }
  // 쿠키 접시
  g.add(mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.015, 20), accent, x, y + 0.008, z - 0.18));
  for (let i = 0; i < 4; i++) g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.012, 12), M.color('#d9a35f', 0.9), x + Math.cos(i * 1.6) * 0.04, y + 0.022, z - 0.18 + Math.sin(i * 1.6) * 0.04));
}

function floorLamp(scene, room, x, z) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.04, 20), M.woodDark(), 0, 0.02, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.45, 10), M.color('#3e3029', 0.5, { metalness: 0.3 }), 0, 0.75, 0));
  const shadeMat = new THREE.MeshStandardMaterial({ color: '#f3dcb6', roughness: 0.9, emissive: '#ffbf66', emissiveIntensity: 0, side: THREE.DoubleSide });
  const shade = mesh(new THREE.CylinderGeometry(0.16, 0.27, 0.32, 24, 1, true), shadeMat, 0, 1.55, 0, { cast: false });
  g.add(shade);
  const bulbMat = new THREE.MeshBasicMaterial({ color: '#fff1cf' });
  g.add(mesh(new THREE.SphereGeometry(0.05, 10, 8), bulbMat, 0, 1.48, 0, { cast: false }));
  const light = new THREE.PointLight('#ffb766', 0, 7, 1.6);
  light.position.set(0, 1.45, 0);
  g.add(light);
  g.position.set(x, 0, z);
  scene.add(g);
  room.obstacles.push({ minX: x - 0.22, maxX: x + 0.22, minZ: z - 0.22, maxZ: z + 0.22 });
  room.nightParts.push((dt, t, night) => {
    shadeMat.emissiveIntensity = night * 0.9;
    light.intensity = night * 9;
    bulbMat.color.setStyle('#bfae95').lerp(new THREE.Color('#fff1cf'), night);
  });
}

function woodStove(scene, room, x, z) {
  const g = new THREE.Group();
  const iron = M.color('#3b3432', 0.6, { metalness: 0.35 });
  // 벽돌 바닥판
  g.add(mesh(rbox(1.1, 0.06, 1.0, 0.02), M.color('#b5765c', 0.95), 0, 0.03, 0, { cast: false }));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.16, 8), iron, sx * 0.24, 0.14, sz * 0.2));
  g.add(mesh(rbox(0.62, 0.6, 0.55, 0.08, 3), iron, 0, 0.52, 0));
  g.add(mesh(rbox(0.68, 0.05, 0.6, 0.02), iron, 0, 0.84, 0));
  const fireMat = new THREE.MeshStandardMaterial({ color: '#2a1408', emissive: '#ff8a2a', emissiveIntensity: 0.8 });
  const win = mesh(rbox(0.36, 0.26, 0.02, 0.05), fireMat, 0, 0.52, 0.28, { cast: false });
  g.add(win);
  g.add(mesh(rbox(0.42, 0.04, 0.03, 0.01), iron, 0, 0.67, 0.285));
  g.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 2.2, 14), iron, 0, 1.95, -0.08));
  // 장작 바구니
  const basket = new THREE.Group();
  basket.add(mesh(rbox(0.42, 0.22, 0.3, 0.04), M.color('#c7a06b', 1), 0, 0.11, 0));
  for (let i = 0; i < 5; i++) {
    const log = mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.46, 8).rotateZ(Math.PI / 2), M.woodMid(), (i % 2) * 0.02 - 0.01, 0.24 + Math.floor(i / 3) * 0.06, -0.08 + (i % 3) * 0.08);
    basket.add(log);
  }
  basket.position.set(-0.05, 0.06, 0.75);
  g.add(basket);
  const light = new THREE.PointLight('#ff8c3a', 1.2, 4.5, 1.8);
  light.position.set(0, 0.55, 0.55);
  g.add(light);
  g.position.set(x, 0, z);
  g.rotation.y = -Math.PI / 2;
  scene.add(g);
  room.obstacles.push({ minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.45, maxZ: z + 0.45 });
  room.obstacles.push({ minX: x - 0.9, maxX: x - 0.45, minZ: z - 0.25, maxZ: z + 0.2 });
  room.stoveSpot = new THREE.Vector3(x - 0.95, 0, z + 0.35);
  room.nightParts.push((dt, t, night) => {
    const f = 0.85 + Math.sin(t * 7.3) * 0.08 + Math.sin(t * 13.1) * 0.06 + Math.sin(t * 3.1) * 0.05;
    fireMat.emissiveIntensity = (0.9 + night * 0.9) * f;
    light.intensity = (0.8 + night * 4.5) * f;
  });
}

function teaCorner(scene, room, x, z) {
  const g = new THREE.Group();
  // 원목 찻상 (낮은 둥근 상)
  g.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 36), M.wood(), 0, 0.3, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.03, 36), M.woodMid(), 0, 0.265, 0));
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    g.add(mesh(rbox(0.06, 0.26, 0.06, 0.015), M.woodMid(), Math.cos(a) * 0.3, 0.13, Math.sin(a) * 0.3));
  }
  teaSet(g, -0.05, 0.325, -0.02);
  scene.add(g);
  g.position.set(x, 0, z);
  room.obstacles.push({ minX: x - 0.48, maxX: x + 0.48, minZ: z - 0.48, maxZ: z + 0.48 });
  const cols = ['#d9a07a', '#a9bba0', '#e6cf9c'];
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + i * (Math.PI * 2 / 3) + 0.4;
    const cx = x + Math.cos(a) * 0.9, cz = z + Math.sin(a) * 0.9;
    const c = mesh(rbox(0.5, 0.1, 0.5, 0.05, 3), M.fabric(cols[i]), cx, 0.05, cz);
    c.rotation.y = -a;
    scene.add(c);
    const knot = mesh(new THREE.SphereGeometry(0.025, 8, 6), M.fabric(cols[i]), cx, 0.105, cz);
    scene.add(knot);
    // 방석에 앉으면 찻상을 바라봄
    const rotY = Math.atan2(x - cx, z - cz);
    room.seats.push({ pos: new THREE.Vector3(cx, 0.1, cz), rotY, taken: null, floor: true });
  }
  room.benchSpots.push(new THREE.Vector3(x + Math.cos(Math.PI * 0.6) * 0.9, 0.1, z + Math.sin(Math.PI * 0.6) * 0.9));
}

function counter(scene, room, x, z) {
  const g = new THREE.Group();
  const L = 2.6, D = 0.6, Hh = 1.0;
  plank(g, L, Hh - 0.05, D, 0, (Hh - 0.05) / 2, 0, M.woodLight(), 0.03);
  plank(g, L + 0.08, 0.05, D + 0.08, 0, Hh - 0.025, 0, M.wood(), 0.02);
  for (let i = 0; i < 5; i++) plank(g, 0.025, Hh - 0.2, 0.02, -L / 2 + 0.3 + i * 0.5, Hh / 2, -D / 2 - 0.005, M.wood(), 0.008);
  // 커피 머신
  const mach = new THREE.Group();
  mach.add(mesh(rbox(0.4, 0.42, 0.34, 0.06), M.color('#e9e2d6', 0.4), 0, 0.21, 0));
  mach.add(mesh(rbox(0.3, 0.06, 0.06, 0.02), M.color('#8a7b6c', 0.4, { metalness: 0.5 }), 0, 0.3, -0.18));
  mach.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 10), M.color('#3f3632', 0.4), -0.08, 0.2, -0.18));
  mach.position.set(-0.7, Hh, 0);
  g.add(mach);
  // 케이크 돔
  const dome = new THREE.Group();
  dome.add(mesh(new THREE.CylinderGeometry(0.17, 0.12, 0.04, 20), M.woodMid(), 0, 0.02, 0));
  dome.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.1, 20), M.color('#f3d9b0', 0.8), 0, 0.09, 0));
  dome.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 20), M.color('#e47f7a', 0.6), 0, 0.15, 0));
  dome.add(mesh(new THREE.SphereGeometry(0.16, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.color('#e7f2f5', 0.05, { transparent: true, opacity: 0.35 }), 0, 0.04, 0, { cast: false }));
  dome.position.set(0.15, Hh, 0.02);
  g.add(dome);
  // 간식 유리병
  for (let i = 0; i < 3; i++) {
    g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 14), M.color('#e8f1f2', 0.1, { transparent: true, opacity: 0.45 }), 0.65 + i * 0.18, Hh + 0.09, -0.05, { cast: false }));
    g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 14), M.color(['#c88a52', '#e7b77c', '#9a6b4c'][i], 1), 0.65 + i * 0.18, Hh + 0.05, -0.05));
    g.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 14), M.woodMid(), 0.65 + i * 0.18, Hh + 0.19, -0.05));
  }
  // 메뉴판
  const c = document.createElement('canvas'); c.width = 256; c.height = 320;
  const p = c.getContext('2d');
  p.fillStyle = '#3e3a36'; p.fillRect(0, 0, 256, 320);
  p.fillStyle = '#f2e7d3'; p.textAlign = 'center';
  p.font = '700 40px "Jua", sans-serif'; p.fillText('MENU', 128, 56);
  p.font = '28px "Gowun Dodum", sans-serif';
  ['따뜻한 라떼', '보리차', '고구마 케이크', '츄르 (고양이용)'].forEach((s, i) => p.fillText(s, 128, 116 + i * 52));
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  document.fonts?.ready.then(() => {
    p.fillStyle = '#3e3a36'; p.fillRect(0, 0, 256, 320);
    p.fillStyle = '#f2e7d3';
    p.font = '700 40px "Jua", sans-serif'; p.fillText('MENU', 128, 56);
    p.font = '28px "Gowun Dodum", sans-serif';
    ['따뜻한 라떼', '보리차', '고구마 케이크', '츄르 (고양이용)'].forEach((s, i) => p.fillText(s, 128, 116 + i * 52));
    tex.needsUpdate = true;
  });
  const board = new THREE.Group();
  board.add(mesh(rbox(0.5, 0.62, 0.03, 0.02), M.woodMid(), 0, 0, 0));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.55), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  face.position.z = 0.017;
  board.add(face);
  board.position.set(1.0, Hh + 0.36, 0.2);
  board.rotation.set(-0.12, Math.PI, 0);
  g.add(board);
  g.position.set(x, 0, z);
  scene.add(g);
  room.obstacles.push({ minX: x - L / 2 - 0.05, maxX: x + L / 2 + 0.05, minZ: z - D / 2 - 0.05, maxZ: z + D / 2 + 0.05 });
  // 바 의자 2개
  for (const sx of [-0.4, 0.5]) {
    const s = new THREE.Group();
    s.add(mesh(new THREE.CylinderGeometry(0.19, 0.17, 0.06, 20), M.wood(), 0, 0.68, 0));
    s.add(mesh(new THREE.CylinderGeometry(0.15, 0.14, 0.05, 20), M.fabric('#c98f6b'), 0, 0.73, 0));
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3;
      const leg = mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.68, 8), M.woodMid(), Math.cos(a) * 0.12, 0.33, Math.sin(a) * 0.12);
      leg.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12);
      s.add(leg);
    }
    s.position.set(x + sx, 0, z - 0.65);
    scene.add(s);
    room.seats.push({ pos: new THREE.Vector3(x + sx, 0.75, z - 0.62), rotY: 0, taken: null, stool: true });
    room.obstacles.push({ minX: x + sx - 0.17, maxX: x + sx + 0.17, minZ: z - 0.82, maxZ: z - 0.48 });
  }
}

function plant(scene, room, x, z, s, rnd) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.34, 18), M.color('#d8916e', 0.9), 0, 0.17, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.04, 18), M.color('#c27c5c', 0.9), 0, 0.34, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 18), M.color('#6b4b36', 1), 0, 0.345, 0, { cast: false }));
  const leafCols = ['#7ead6f', '#8fbd7e', '#6e9c62', '#a0c88d'];
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2;
    const h = 0.5 + rnd() * 0.55;
    const stem = mesh(new THREE.CylinderGeometry(0.008, 0.01, h, 5), M.color('#5d8452'), Math.cos(a) * 0.04, 0.34 + h / 2, Math.sin(a) * 0.04);
    stem.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
    g.add(stem);
    const leaf = mesh(new THREE.SphereGeometry(0.12, 12, 8), M.color(leafCols[i % 4], 1), Math.cos(a) * (0.08 + h * 0.3), 0.34 + h, Math.sin(a) * (0.08 + h * 0.3));
    leaf.scale.set(1, 0.35, 0.6);
    leaf.rotation.set(0, -a, 0.5);
    g.add(leaf);
  }
  g.scale.setScalar(s);
  g.position.set(x, 0, z);
  scene.add(g);
  room.obstacles.push({ minX: x - 0.25 * s, maxX: x + 0.25 * s, minZ: z - 0.25 * s, maxZ: z + 0.25 * s });
}

// 정원으로 나가는 유리 양문 (사람 · 고양이가 다가가면 열림)
function gardenDoor(scene, room) {
  const x = ROOM.maxX + WT / 2;
  const half = (DOOR.z1 - DOOR.z0) / 2;
  const frame = M.wood();
  scene.add(mesh(rbox(WT + 0.08, 0.1, DOOR.z1 - DOOR.z0 + 0.2, 0.02), frame, x, DOOR.h + 0.05, 0));
  for (const s of [-1, 1]) scene.add(mesh(rbox(WT + 0.08, DOOR.h, 0.1, 0.02), frame, x, DOOR.h / 2, s * (half + 0.05)));
  const glass = new THREE.MeshStandardMaterial({ color: '#d9ecf2', transparent: true, opacity: 0.35, roughness: 0.05 });
  const leaves = [];
  for (const s of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(x + 0.04, 0, s * half);
    const leaf = new THREE.Group();
    leaf.position.z = -s * half / 2;
    const w = half - 0.02;
    leaf.add(mesh(rbox(0.05, DOOR.h - 0.05, 0.07, 0.015), M.woodMid(), 0, DOOR.h / 2, -s * (w / 2 - 0.035)));
    leaf.add(mesh(rbox(0.05, DOOR.h - 0.05, 0.07, 0.015), M.woodMid(), 0, DOOR.h / 2, s * (w / 2 - 0.035)));
    for (const y of [0.05, DOOR.h * 0.42, DOOR.h - 0.06]) leaf.add(mesh(rbox(0.05, 0.08, w, 0.015), M.woodMid(), 0, y, 0));
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.015, DOOR.h - 0.2, w - 0.1), glass);
    pane.position.y = DOOR.h / 2;
    leaf.add(pane);
    leaf.add(mesh(new THREE.SphereGeometry(0.03, 10, 8), M.color('#c9a24a', 0.3, { metalness: 0.6 }), 0.05, 1.0, -s * (w / 2 - 0.1)));
    hinge.add(leaf);
    scene.add(hinge);
    leaves.push({ hinge, s });
  }
  // 문 앞 매트
  scene.add(mesh(rbox(0.6, 0.015, 1.3, 0.04), M.fabric('#c7865e'), ROOM.maxX - 0.4, 0.008, 0, { cast: false }));
  let open = 0;
  return {
    center: new THREE.Vector3(ROOM.maxX, 0, 0),
    update(dt, near) {
      open += ((near ? 1 : 0) - open) * (1 - Math.exp(-5 * dt));
      // 바깥쪽(정원 쪽)으로 열림
      for (const L of leaves) L.hinge.rotation.y = L.s * open * 1.45;
    },
  };
}

// 창가 바 좌석 (창 밖을 보며 앉는 긴 원목 선반 + 높은 의자)
function windowBar(scene, room, x) {
  const z = ROOM.minZ;
  const L = 2.9;
  scene.add(mesh(rbox(L, 0.05, 0.42, 0.02), M.wood(), x, 1.02, z + 0.21));
  for (const s of [-1, 0, 1]) scene.add(mesh(rbox(0.04, 0.16, 0.3, 0.01), M.woodMid(), x + s * (L / 2 - 0.2), 0.92, z + 0.15));
  // 작은 소품: 컵 · 화분
  scene.add(mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.09, 14), M.color('#f6efe4', 0.35), x - 0.7, 1.09, z + 0.22));
  scene.add(mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.09, 12), M.color('#d98f6f', 0.9), x + 1.2, 1.09, z + 0.2));
  scene.add(mesh(new THREE.SphereGeometry(0.07, 10, 8), M.color('#86b479', 1), x + 1.2, 1.18, z + 0.2));
  room.obstacles.push({ minX: x - L / 2, maxX: x + L / 2, minZ: z, maxZ: z + 0.44 });
  room.benchSpots.push(new THREE.Vector3(x + 0.6, 1.045, z + 0.2));
  for (const sx of [-0.95, 0, 0.95]) {
    const st = new THREE.Group();
    st.add(mesh(new THREE.CylinderGeometry(0.19, 0.17, 0.06, 20), M.wood(), 0, 0.72, 0));
    st.add(mesh(new THREE.CylinderGeometry(0.15, 0.14, 0.05, 20), M.fabric('#a9bba0'), 0, 0.77, 0));
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3;
      const leg = mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.72, 8), M.woodMid(), Math.cos(a) * 0.12, 0.35, Math.sin(a) * 0.12);
      leg.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12);
      st.add(leg);
    }
    st.position.set(x + sx, 0, z + 0.72);
    scene.add(st);
    room.obstacles.push({ minX: x + sx - 0.17, maxX: x + sx + 0.17, minZ: z + 0.55, maxZ: z + 0.89 });
    room.seats.push({ pos: new THREE.Vector3(x + sx, 0.79, z + 0.66), rotY: Math.PI, taken: null, stool: true });
  }
}

// 2인용 원목 카페 테이블
function cafeTable(scene, room, x, z, cushion) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 28), M.wood(), 0, 0.74, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.72, 10), M.woodMid(), 0, 0.37, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.03, 20), M.woodMid(), 0, 0.015, 0));
  // 작은 꽃병
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.1, 12), M.color('#e8f1f2', 0.1, { transparent: true, opacity: 0.6 }), 0.1, 0.81, -0.08, { cast: false }));
  g.add(mesh(new THREE.SphereGeometry(0.035, 10, 8), M.color(['#f2a7a0', '#f6d36b', '#c9b6e4'][Math.abs(Math.round(x * 3)) % 3], 1), 0.1, 0.89, -0.08));
  g.position.set(x, 0, z);
  scene.add(g);
  room.obstacles.push({ minX: x - 0.36, maxX: x + 0.36, minZ: z - 0.36, maxZ: z + 0.36 });
  for (const s of [-1, 1]) {
    const c = new THREE.Group();
    const cx = x + s * 0.68;
    c.add(mesh(rbox(0.42, 0.05, 0.42, 0.02), M.wood(), 0, 0.44, 0));
    c.add(mesh(rbox(0.38, 0.045, 0.38, 0.02, 3), M.fabric(cushion), 0, 0.485, 0));
    c.add(mesh(rbox(0.04, 0.42, 0.4, 0.015), M.woodMid(), s * 0.19, 0.68, 0));
    for (const lx of [-0.17, 0.17]) for (const lz of [-0.17, 0.17]) c.add(mesh(rbox(0.035, 0.42, 0.035, 0.01), M.woodMid(), lx, 0.21, lz));
    c.position.set(cx, 0, z);
    scene.add(c);
    room.obstacles.push({ minX: cx - 0.22, maxX: cx + 0.22, minZ: z - 0.22, maxZ: z + 0.22 });
    room.seats.push({ pos: new THREE.Vector3(cx, 0.5, z), rotY: s > 0 ? -Math.PI / 2 : Math.PI / 2, taken: null, side: true });
  }
}

export { textSprite };
