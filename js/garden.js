// 카페 바깥 정원 (동쪽 문으로 이어짐)
import * as THREE from 'three';
import { M, rbox, mesh, plank, mulberry } from './kit.js';
import { ROOM, WORLD } from './room.js';

const GX0 = ROOM.maxX + 0.2, GX1 = WORLD.maxX, GZ0 = WORLD.minZ, GZ1 = WORLD.maxZ;

function grassTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#9fbf7a'; g.fillRect(0, 0, 512, 512);
  const r = mulberry(21);
  for (let i = 0; i < 9000; i++) {
    const x = r() * 512, y = r() * 512;
    g.strokeStyle = r() < 0.5 ? 'rgba(80,120,50,0.35)' : 'rgba(200,230,150,0.35)';
    g.lineWidth = 1 + r();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - 3 - r() * 4); g.stroke();
  }
  for (let i = 0; i < 40; i++) {
    g.fillStyle = 'rgba(120,160,80,0.25)';
    g.beginPath(); g.ellipse(r() * 512, r() * 512, 20 + r() * 50, 12 + r() * 30, r() * 3, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 3);
  t.anisotropy = 4;
  return t;
}

export function buildGarden(scene, room) {
  const r = mulberry(77);
  const obst = (x0, x1, z0, z1) => room.obstacles.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1 });
  const seats = room.seats;
  const anim = [];

  // 잔디
  const grass = mesh(new THREE.BoxGeometry(GX1 - ROOM.maxX, 0.04, GZ1 - GZ0), new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 }), (ROOM.maxX + GX1) / 2, -0.02, 0, { cast: false });
  grass.name = 'grass';
  scene.add(grass);

  // 디딤돌 길: 문 → 데크 → 나무 · 연못
  const stoneMat = M.color('#d8cfc2', 0.95);
  const path = [];
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    path.push([10 + t * 6.5, Math.sin(t * 3.2) * 1.3 - 0.2]);
  }
  for (const [x, z] of path) {
    const s = mesh(new THREE.CylinderGeometry(0.22 + r() * 0.06, 0.25, 0.04, 9), stoneMat, x + (r() - 0.5) * 0.1, 0.015, z + (r() - 0.5) * 0.1, { cast: false });
    s.rotation.y = r() * 3;
    s.scale.z = 0.8;
    scene.add(s);
  }

  // ---------- 원목 데크 + 파라솔 테이블 ----------
  const deckX0 = GX0, deckX1 = 9.6;
  const deck = new THREE.Group();
  for (let x = deckX0 + 0.1; x < deckX1; x += 0.3) {
    deck.add(mesh(rbox(0.28, 0.05, 6.4, 0.01), r() < 0.5 ? M.wood() : M.woodLight(), x, 0.025, 0, { cast: false }));
  }
  scene.add(deck);
  for (const z of [-2.0, 2.0]) {
    const x = 8.1;
    const t = new THREE.Group();
    t.add(mesh(rbox(0.8, 0.05, 0.8, 0.02), M.wood(), 0, 0.74, 0));
    for (const lx of [-0.33, 0.33]) for (const lz of [-0.33, 0.33]) t.add(mesh(rbox(0.05, 0.72, 0.05, 0.01), M.woodMid(), lx, 0.36, lz));
    // 파라솔
    t.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.2, 8), M.color('#efe7da', 0.5), 0, 1.1, 0));
    const canopy = mesh(new THREE.ConeGeometry(1.25, 0.45, 12, 1, true), new THREE.MeshStandardMaterial({ color: z < 0 ? '#e8a87c' : '#9fb7a0', roughness: 0.9, side: THREE.DoubleSide }), 0, 2.15, 0);
    t.add(canopy);
    t.add(mesh(new THREE.SphereGeometry(0.04, 8, 6), M.woodMid(), 0, 2.4, 0));
    t.add(mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.1, 12), M.color('#f6efe4', 0.35), 0.15, 0.81, 0.1));
    t.position.set(x, 0.05, z);
    scene.add(t);
    obst(x - 0.42, x + 0.42, z - 0.42, z + 0.42);
    for (const s of [-1, 1]) {
      const cz = z + s * 0.75;
      const c = new THREE.Group();
      c.add(mesh(rbox(0.44, 0.05, 0.44, 0.02), M.woodLight(), 0, 0.45, 0));
      c.add(mesh(rbox(0.44, 0.4, 0.05, 0.015), M.woodLight(), 0, 0.68, s * 0.2));
      for (const lx of [-0.18, 0.18]) for (const lz of [-0.18, 0.18]) c.add(mesh(rbox(0.035, 0.44, 0.035, 0.01), M.woodMid(), lx, 0.22, lz));
      c.position.set(x, 0.05, cz);
      scene.add(c);
      obst(x - 0.23, x + 0.23, cz - 0.23, cz + 0.23);
      seats.push({ pos: new THREE.Vector3(x, 0.55, cz), rotY: s > 0 ? Math.PI : 0, taken: null, side: true });
    }
  }
  // 데크 위 전구 줄
  const bulbs = [];
  {
    const posts = [[GX0 + 0.15, -3.1], [9.5, -3.1], [9.5, 3.1], [GX0 + 0.15, 3.1]];
    for (const [x, z] of posts.slice(1, 3)) scene.add(mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.6, 8), M.woodDark(), x, 1.3, z));
    const lines = [[posts[0], posts[1]], [posts[1], posts[2]], [posts[2], posts[3]]];
    for (const [[x0, z0], [x1, z1]] of lines) {
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        pts.push(new THREE.Vector3(x0 + (x1 - x0) * t, 2.55 - Math.sin(t * Math.PI) * 0.3, z0 + (z1 - z0) * t));
        if (i > 0 && i < 10) {
          const m = new THREE.MeshStandardMaterial({ color: '#ffe3a0', emissive: '#ffcf7a', emissiveIntensity: 0.1 });
          const b = mesh(new THREE.SphereGeometry(0.045, 8, 6), m, pts[i].x, pts[i].y - 0.06, pts[i].z, { cast: false });
          scene.add(b);
          bulbs.push(m);
        }
      }
      scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.006, 4), M.color('#5a4636')));
    }
  }
  room.benchSpots.push(new THREE.Vector3(7.0, 0.05, -3.0));

  // ---------- 큰 나무 + 그네 ----------
  const treeX = 16.3, treeZ = -3.4;
  {
    const t = new THREE.Group();
    const bark = M.color('#8b6a4a', 1);
    t.add(mesh(new THREE.CylinderGeometry(0.28, 0.42, 3.0, 12), bark, 0, 1.5, 0));
    const br = mesh(new THREE.CylinderGeometry(0.1, 0.16, 1.9, 8), bark, 0.85, 2.9, 0.25);
    br.rotation.z = -0.95;
    t.add(br);
    const leafCols = ['#86ad6c', '#97bd78', '#7aa261', '#a6c98a'];
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2, rr = 0.3 + r() * 1.3;
      const s = mesh(new THREE.SphereGeometry(0.75 + r() * 0.5, 14, 10), M.color(leafCols[i % 4], 1), Math.cos(a) * rr + 0.4, 3.4 + r() * 1.1, Math.sin(a) * rr * 0.8);
      t.add(s);
    }
    t.position.set(treeX, 0, treeZ);
    scene.add(t);
    obst(treeX - 0.45, treeX + 0.45, treeZ - 0.45, treeZ + 0.45);
    // 그네 (가지에 매달림)
    const sw = new THREE.Group();
    sw.position.set(treeX + 1.45, 3.15, treeZ + 0.25);
    for (const s of [-1, 1]) sw.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.6, 6), M.color('#d9c7a5'), s * 0.32, -1.3, 0));
    sw.add(mesh(rbox(0.8, 0.05, 0.36, 0.02), M.wood(), 0, -2.6, 0));
    scene.add(sw);
    const swingSeat = { pos: new THREE.Vector3(treeX + 1.45, 0.58, treeZ + 0.25), rotY: 0, taken: null, swing: sw };
    seats.push(swingSeat);
    anim.push((dt, t) => { sw.rotation.x = Math.sin(t * 1.2) * (swingSeat.taken || swingSeat.remoteTaken ? 0.22 : 0.04); });
  }

  // ---------- 연못 + 비단잉어 ----------
  const pondX = 15.4, pondZ = 2.7;
  {
    const water = mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.03, 40), new THREE.MeshStandardMaterial({ color: '#7fb3c8', roughness: 0.15, metalness: 0.1 }), pondX, 0.012, pondZ, { cast: false });
    water.scale.z = 0.7;
    scene.add(water);
    for (let i = 0; i < 22; i++) {
      const a = i / 22 * Math.PI * 2;
      const s = mesh(new THREE.SphereGeometry(0.17 + r() * 0.08, 9, 7), M.color(r() < 0.5 ? '#c9c1b4' : '#b4ab9d', 1), pondX + Math.cos(a) * 1.7, 0.05, pondZ + Math.sin(a) * 1.2);
      s.scale.y = 0.55;
      scene.add(s);
    }
    for (let i = 0; i < 4; i++) {
      const lp = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.01, 14, 1, false, 0, 5.6), M.color('#79a85f', 0.8), pondX - 0.8 + i * 0.5, 0.032, pondZ + (r() - 0.5) * 0.8, { cast: false });
      lp.rotation.y = r() * 6;
      scene.add(lp);
    }
    const koi = [];
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Group();
      const body = mesh(new THREE.SphereGeometry(0.09, 10, 8), M.color(['#f08a3c', '#f4f0e6', '#e66b4f'][i], 0.6), 0, 0, 0, { cast: false });
      body.scale.set(0.6, 0.35, 1.4);
      f.add(body);
      const tail = mesh(new THREE.ConeGeometry(0.05, 0.08, 6), body.material, 0, 0, -0.14, { cast: false });
      tail.rotation.x = Math.PI / 2;
      f.add(tail);
      scene.add(f);
      koi.push({ f, ph: i * 2.1, sp: 0.35 + i * 0.1 });
    }
    obst(pondX - 1.75, pondX + 1.75, pondZ - 1.2, pondZ + 1.2);
    room.pond = new THREE.Vector3(pondX, 0, pondZ);
    room.gardenSpots.push(new THREE.Vector3(pondX - 1.95, 0, pondZ - 0.6), new THREE.Vector3(pondX, 0, pondZ - 1.45));
    anim.push((dt, t) => {
      for (const k of koi) {
        const a = t * k.sp + k.ph;
        k.f.position.set(pondX + Math.cos(a) * 1.0, 0.0, pondZ + Math.sin(a * 1.3) * 0.55);
        k.f.rotation.y = Math.atan2(-Math.sin(a) * 1.0, Math.cos(a * 1.3) * 0.55 * 1.3);
      }
    });
  }

  // ---------- 화단 + 울타리 + 산울타리 ----------
  const flowerCols = ['#f2a7a0', '#f6d36b', '#c9b6e4', '#fbf3e8', '#ef8f7a', '#9cc3e6'];
  function bed(x, z, w, d) {
    scene.add(mesh(rbox(w, 0.16, d, 0.05), M.woodMid(), x, 0.08, z));
    scene.add(mesh(rbox(w - 0.1, 0.06, d - 0.1, 0.03), M.color('#6b4b36', 1), x, 0.15, z, { cast: false }));
    const n = Math.round(w * d * 14);
    for (let i = 0; i < n; i++) {
      const fx = x + (r() - 0.5) * (w - 0.2), fz = z + (r() - 0.5) * (d - 0.2);
      const h = 0.12 + r() * 0.2;
      scene.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, h, 4), M.color('#5d8452'), fx, 0.17 + h / 2, fz, { cast: false }));
      scene.add(mesh(new THREE.SphereGeometry(0.04 + r() * 0.025, 8, 6), M.color(flowerCols[Math.floor(r() * flowerCols.length)], 0.9), fx, 0.19 + h, fz, { cast: false }));
    }
    obst(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
  }
  bed(12.2, GZ1 - 0.45, 3.0, 0.7);
  bed(18.4, GZ1 - 0.45, 2.6, 0.7);
  bed(GX1 - 0.45, 1.0, 0.7, 2.4);
  bed(11.2, GZ0 + 0.5, 2.4, 0.7);

  // 뒤쪽 산울타리
  const hedgeMat = M.color('#7ea366', 1);
  for (let x = GX0 + 0.3; x < GX1; x += 0.55) {
    const h = mesh(new THREE.SphereGeometry(0.42, 12, 10), hedgeMat, x, 0.45, GZ0 - 0.05);
    h.scale.set(1, 1.15, 0.7);
    scene.add(h);
  }
  // 앞쪽 · 오른쪽 낮은 울타리
  const fenceMat = M.color('#f3ead9', 0.8);
  for (let x = GX0 + 0.2; x <= GX1; x += 0.32) scene.add(mesh(rbox(0.08, 0.5, 0.04, 0.02), fenceMat, x, 0.25, GZ1 + 0.1));
  scene.add(mesh(rbox(GX1 - GX0, 0.06, 0.03, 0.01), fenceMat, (GX0 + GX1) / 2, 0.38, GZ1 + 0.12));
  for (let z = GZ0; z <= GZ1; z += 0.32) scene.add(mesh(rbox(0.04, 0.5, 0.08, 0.02), fenceMat, GX1 + 0.1, 0.25, z));
  scene.add(mesh(rbox(0.03, 0.06, GZ1 - GZ0, 0.01), fenceMat, GX1 + 0.12, 0.38, 0));

  // ---------- 벤치 ----------
  function bench(x, z, rotY) {
    const g = new THREE.Group();
    g.add(mesh(rbox(1.5, 0.06, 0.42, 0.02), M.wood(), 0, 0.45, 0));
    g.add(mesh(rbox(1.5, 0.32, 0.05, 0.02), M.wood(), 0, 0.72, -0.2));
    for (const sx of [-0.6, 0.6]) g.add(mesh(rbox(0.06, 0.45, 0.4, 0.015), M.woodDark(), sx, 0.22, 0));
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    scene.add(g);
    g.updateMatrixWorld(true);
    const along = Math.abs(Math.sin(rotY)) > 0.5;
    obst(x - (along ? 0.25 : 0.78), x + (along ? 0.25 : 0.78), z - (along ? 0.78 : 0.25), z + (along ? 0.78 : 0.25));
    for (const lx of [-0.38, 0.38]) {
      const p = g.localToWorld(new THREE.Vector3(lx, 0.5, 0.02));
      seats.push({ pos: p, rotY, taken: null });
    }
    room.benchSpots.push(g.localToWorld(new THREE.Vector3(0, 0.5, 0)));
  }
  bench(13.4, GZ1 - 1.35, Math.PI);
  bench(GX1 - 1.3, -1.8, -Math.PI / 2);
  bench(12.8, -3.9, 0);

  // ---------- 새 모이대 (창가 고양이 채터링용) ----------
  const birds = [];
  {
    const x = 11.0, z = -2.2;
    scene.add(mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.3, 8), M.woodMid(), x, 0.65, z));
    scene.add(mesh(rbox(0.5, 0.04, 0.5, 0.02), M.wood(), x, 1.32, z));
    const roof = mesh(new THREE.ConeGeometry(0.42, 0.25, 4), M.color('#c27c5c', 0.9), x, 1.62, z);
    roof.rotation.y = Math.PI / 4;
    scene.add(roof);
    for (const s of [-1, 1]) scene.add(mesh(rbox(0.03, 0.28, 0.03, 0.01), M.woodMid(), x + s * 0.2, 1.47, z));
    obst(x - 0.15, x + 0.15, z - 0.15, z + 0.15);
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Group();
      const bc = ['#7d6a5a', '#c99a63', '#8aa0b8'][i];
      b.add(mesh(new THREE.SphereGeometry(0.05, 10, 8), M.color(bc, 0.8), 0, 0, 0));
      b.add(mesh(new THREE.SphereGeometry(0.032, 8, 6), M.color(bc, 0.8), 0, 0.04, 0.035));
      const beak = mesh(new THREE.ConeGeometry(0.01, 0.025, 5), M.color('#e8b04a'), 0, 0.04, 0.07);
      beak.rotation.x = Math.PI / 2;
      b.add(beak);
      scene.add(b);
      birds.push({ b, home: new THREE.Vector3(x - 0.15 + i * 0.15, 1.39, z + (i - 1) * 0.08), ph: r() * 6, away: 0 });
    }
    room.birdFeeder = new THREE.Vector3(x, 0, z);
    room.gardenSpots.push(new THREE.Vector3(x - 0.9, 0, z + 0.6), new THREE.Vector3(x + 0.8, 0, z + 0.7));
  }

  // ---------- 바깥 고양이 집 ----------
  {
    const x = 18.6, z = -4.3;
    const g = new THREE.Group();
    g.add(mesh(rbox(0.7, 0.5, 0.6, 0.03), M.woodLight(), 0, 0.25, 0));
    const roofL = mesh(rbox(0.5, 0.04, 0.72, 0.015), M.color('#c27c5c', 0.9), -0.18, 0.62, 0);
    roofL.rotation.z = 0.6;
    const roofR = roofL.clone(); roofR.position.x = 0.18; roofR.rotation.z = -0.6;
    g.add(roofL, roofR);
    g.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 20).rotateX(Math.PI / 2), M.color('#3a2a20', 1), 0, 0.24, 0.3, { cast: false }));
    g.position.set(x, 0, z);
    scene.add(g);
    obst(x - 0.4, x + 0.4, z - 0.35, z + 0.35);
    room.boxes.push({ floor: new THREE.Vector3(x, 0, z + 0.7), inside: new THREE.Vector3(x, 0.04, z), rotY: 0, key: 'gardenHouse', outdoor: true });
  }

  // ---------- 정원 등불 ----------
  const lanternMats = [];
  const lanternLights = [];
  for (const [x, z, light] of [[10.2, 1.4, true], [14.2, -1.6, false], [17.8, 0.4, true], [12.6, 3.2, false]]) {
    scene.add(mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.9, 8), M.woodDark(), x, 0.45, z));
    const m = new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffc766', emissiveIntensity: 0.05, roughness: 0.6 });
    scene.add(mesh(rbox(0.18, 0.22, 0.18, 0.04), m, x, 1.0, z, { cast: false }));
    scene.add(mesh(new THREE.ConeGeometry(0.15, 0.1, 4).rotateY(Math.PI / 4), M.woodDark(), x, 1.16, z));
    lanternMats.push(m);
    if (light) {
      const L = new THREE.PointLight('#ffbb66', 0, 5, 1.8);
      L.position.set(x, 1.0, z);
      scene.add(L);
      lanternLights.push(L);
    }
    obst(x - 0.1, x + 0.1, z - 0.1, z + 0.1);
  }

  // ---------- 나비(낮) · 반딧불(밤) ----------
  const N = 26;
  const flyGeo = new THREE.BufferGeometry();
  const fp = new Float32Array(N * 3);
  flyGeo.setAttribute('position', new THREE.BufferAttribute(fp, 3));
  const flyMat = new THREE.PointsMaterial({ color: '#fff6b0', size: 0.09, transparent: true, opacity: 0, depthWrite: false });
  const flies = new THREE.Points(flyGeo, flyMat);
  flies.frustumCulled = false;
  scene.add(flies);
  const flySeed = Array.from({ length: N }, () => [GX0 + 1 + r() * (GX1 - GX0 - 2), r() * 10 - 5, r() * 6, 0.3 + r() * 0.6]);
  const butterflies = [];
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Group();
    const wm = new THREE.MeshStandardMaterial({ color: ['#f6d36b', '#f2a7a0', '#ffffff', '#9cc3e6'][i], side: THREE.DoubleSide, roughness: 0.8 });
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.CircleGeometry(0.06, 10), wm);
      w.position.x = s * 0.05;
      w.rotation.x = -Math.PI / 2;
      b.add(w);
    }
    scene.add(b);
    butterflies.push({ b, c: new THREE.Vector3(12 + r() * 6, 0.7, r() * 7 - 3.5), ph: r() * 6 });
  }

  // ---------- 비 (정원 위) ----------
  const RN = 420;
  const rainGeo = new THREE.BufferGeometry();
  const rp = new Float32Array(RN * 6);
  const rs = new Float32Array(RN);
  for (let i = 0; i < RN; i++) {
    const x = GX0 + r() * (GX1 - GX0), y = r() * 5, z = GZ0 + r() * (GZ1 - GZ0);
    rp.set([x, y, z, x - 0.02, y - 0.22, z], i * 6);
    rs[i] = 5 + r() * 2;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  const rainMat = new THREE.LineBasicMaterial({ color: '#c7d6e6', transparent: true, opacity: 0.5 });
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false;
  scene.add(rain);

  room.nightParts.push((dt, t, night) => {
    for (const fn of anim) fn(dt, t);
    bulbs.forEach((m, i) => { m.emissiveIntensity = 0.1 + night * (1.7 + Math.sin(t * 1.4 + i) * 0.3); });
    lanternMats.forEach((m) => { m.emissiveIntensity = 0.05 + night * 1.6; });
    lanternLights.forEach((L) => { L.intensity = night * 6; });
    // 반딧불
    flyMat.opacity = night * 0.9;
    flies.visible = night > 0.05;
    if (flies.visible) {
      for (let i = 0; i < N; i++) {
        const [x, z, ph, sp] = flySeed[i];
        fp[i * 3] = x + Math.sin(t * sp + ph) * 0.8;
        fp[i * 3 + 1] = 0.5 + Math.sin(t * sp * 1.7 + ph) * 0.35 + 0.3;
        fp[i * 3 + 2] = z + Math.cos(t * sp * 0.8 + ph) * 0.8;
      }
      flyGeo.attributes.position.needsUpdate = true;
      flyMat.size = 0.07 + Math.sin(t * 6) * 0.015;
    }
    // 나비 (낮, 비 안 올 때)
    const showB = night < 0.5 && !room.rainOn;
    for (const B of butterflies) {
      B.b.visible = showB;
      if (!showB) continue;
      const a = t * 0.5 + B.ph;
      B.b.position.set(B.c.x + Math.sin(a) * 1.6, B.c.y + Math.sin(a * 3.1) * 0.25, B.c.z + Math.sin(a * 0.7) * 1.2);
      B.b.rotation.y = a;
      const flap = Math.sin(t * 18 + B.ph) * 0.9;
      B.b.children[0].rotation.y = flap; B.b.children[1].rotation.y = -flap;
    }
    // 새: 비 오거나 밤이면 숨음, 고양이가 가까이 오면 날아감
    for (const B of birds) {
      const hide = night > 0.5 || room.rainOn || B.away > 0;
      B.away = Math.max(0, B.away - dt);
      B.b.visible = !hide;
      if (hide) continue;
      const hop = Math.max(0, Math.sin(t * 2.3 + B.ph)) ** 8 * 0.06;
      B.b.position.copy(B.home).add(new THREE.Vector3(Math.sin(t * 0.7 + B.ph) * 0.05, hop, 0));
      B.b.rotation.y = Math.sin(t * 0.9 + B.ph) * 1.5;
    }
    // 비
    rain.visible = !!room.rainOn;
    if (rain.visible) {
      const a = rainGeo.attributes.position.array;
      for (let i = 0; i < RN; i++) {
        const dy = rs[i] * dt;
        a[i * 6 + 1] -= dy; a[i * 6 + 4] -= dy;
        if (a[i * 6 + 4] < 0) { a[i * 6 + 1] += 5; a[i * 6 + 4] += 5; }
      }
      rainGeo.attributes.position.needsUpdate = true;
    }
  });
  room.scareBirds = () => { for (const B of birds) B.away = 8 + Math.random() * 6; };
  room.birdsPresent = () => birds.some((B) => B.b.visible);
  void plank;
}
