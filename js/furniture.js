// 고양이서가 제품 가구: 오르미캣타워, 커스텀B 월캣타워
// - 처음엔 코드로 만든 모델을 쓰고, config.js 에 glb 경로를 넣으면 그 파일로 바뀝니다.
// - 고양이가 오르내리는 길(path)과 숨숨집(box) 자리는 모델과 따로 정의되어 있어
//   GLB로 바꿔도 고양이 동작은 그대로 유지됩니다.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CONFIG } from './config.js';
import { M, rbox, mesh, plank } from './kit.js';

const U = 0.45;   // 오르미 한 칸 폭 · 깊이 (m)
const T = 0.03;   // 판재 두께
const POST = 0.042;

// ---------- 부품 ----------
function sisalMaterial() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#cdb38a'; g.fillRect(0, 0, 64, 128);
  for (let y = 0; y < 128; y += 4) {
    g.fillStyle = '#a98a5e'; g.fillRect(0, y, 64, 1.5);
    g.fillStyle = '#e2cca4'; g.fillRect(0, y + 2, 64, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 3);
  return new THREE.MeshStandardMaterial({ map: t, roughness: 1 });
}
let _sisal;
const sisal = () => (_sisal ||= sisalMaterial());

// 둥근 구멍 뚫린 판 (숨숨집 앞판)
function holePanel(w, h, holeR, holeY, mat) {
  const s = new THREE.Shape();
  const r = 0.012;
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const hole = new THREE.Path();
  hole.absarc(0, holeY, holeR, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, { depth: T - 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 28 });
  geo.translate(0, 0, -(T - 0.008) / 2);
  // 나뭇결 UV 크기 보정
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.6, uv.getY(i) * 1.6);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// 열린 프레임 한 칸 (기둥 4개 + 위판 + 아래 테두리)
function frameColumn(g, cx, H, opts = {}) {
  const wood = M.wood();
  const dark = M.woodMid();
  const half = U / 2 - POST / 2;
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    if (opts.skipPosts && opts.skipPosts.includes(`${dx},${dz}`)) continue;
    const isSisal = opts.sisal && dx === 1 && dz === 1;
    if (isSisal) {
      const m = mesh(new THREE.CylinderGeometry(0.036, 0.036, H - T, 18), sisal(), cx + dx * half, (H - T) / 2, dz * half);
      g.add(m);
    } else {
      plank(g, POST, H - T, POST, cx + dx * half, (H - T) / 2, dz * half, dark, 0.008);
    }
  }
  // 위판 (조금 튀어나오게)
  plank(g, U + 0.02, T, U + 0.02, cx, H - T / 2, 0, wood, 0.012);
  // 아래 테두리
  plank(g, U - POST, 0.03, 0.025, cx, 0.05, half, dark, 0.006);
  plank(g, U - POST, 0.03, 0.025, cx, 0.05, -half, dark, 0.006);
  if (opts.midShelf) plank(g, U - 0.01, T * 0.8, U - 0.01, cx, opts.midShelf, 0, wood, 0.01);
}

// 숨숨집 상자 한 칸 (구멍 뚫린 닫힌 상자, 위가 첫 계단)
function hideBox(g, cx, H) {
  const wood = M.woodLight();
  const mid = M.wood();
  // 바닥
  plank(g, U, T, U, cx, T / 2, 0, mid, 0.01);
  // 옆판, 뒤판
  plank(g, T, H - T * 2, U, cx - U / 2 + T / 2, H / 2, 0, wood, 0.01);
  plank(g, T, H - T * 2, U, cx + U / 2 - T / 2, H / 2, 0, wood, 0.01);
  plank(g, U - T * 2, H - T * 2, T, cx, H / 2, -U / 2 + T / 2, wood, 0.01);
  // 앞판 (둥근 입구)
  const front = holePanel(U - T * 2 + 0.004, H - T * 2, 0.13, -0.02, wood);
  front.position.set(cx, H / 2, U / 2 - T / 2);
  g.add(front);
  // 위판 = 계단
  plank(g, U + 0.02, T, U + 0.02, cx, H - T / 2, 0, M.wood(), 0.012);
  // 안쪽 쿠션
  const cushion = mesh(rbox(U - 0.08, 0.04, U - 0.08, 0.018), M.fabric('#efe4d2'), cx, T + 0.02, 0);
  g.add(cushion);
}

// 옆 수납칸 (서랍 + 열린 칸)
function sideStorage(g, cx, w, H) {
  const wood = M.woodLight();
  const mid = M.wood();
  plank(g, w, T, U, cx, T / 2, 0, mid, 0.01);
  plank(g, T, H - T, U, cx - w / 2 + T / 2, (H - T) / 2 + T / 2, 0, wood, 0.01);
  plank(g, T, H - T, U, cx + w / 2 - T / 2, (H - T) / 2 + T / 2, 0, wood, 0.01);
  plank(g, w - T * 2, H - T, T, cx, (H - T) / 2 + T / 2, -U / 2 + T / 2, wood, 0.01);
  plank(g, w + 0.02, T, U + 0.02, cx, H - T / 2, 0, M.wood(), 0.012);
  plank(g, w - T * 2, T * 0.8, U - T, cx, H * 0.45, 0, mid, 0.01);
  // 아래 서랍
  const dh = H * 0.45 - T * 1.5;
  plank(g, w - T * 2 - 0.01, dh - 0.01, T, cx, T + dh / 2, U / 2 - T / 2, M.woodLight(), 0.01);
  const knob = mesh(new THREE.SphereGeometry(0.017, 14, 10), M.woodDark(), cx, T + dh / 2, U / 2 + 0.008);
  g.add(knob);
  // 위 칸 안의 소품: 장난감 공, 털실
  const ball = mesh(new THREE.SphereGeometry(0.045, 16, 12), M.color('#e98b7a', 0.9), cx - 0.04, H * 0.45 + 0.06, 0.05);
  g.add(ball);
  const yarn = mesh(new THREE.TorusKnotGeometry(0.03, 0.012, 40, 6, 2, 3), M.color('#8fb3c9', 1), cx + 0.06, H * 0.45 + 0.055, -0.04);
  g.add(yarn);
}

function felt(g, x, y, color = '#d9d2c6') {
  const m = mesh(rbox(U - 0.06, 0.018, U - 0.06, 0.008), M.fabric(color), x, y + 0.009, 0);
  g.add(m);
}

// ---------- 오르미캣타워 ----------
// 로컬 좌표: x = 길이 방향, +z = 앞, 원점 = 바닥 중심
export function buildOrmiModel() {
  const g = new THREE.Group();
  hideBox(g, -U, U);                                   // 1칸: 숨숨집 상자 (위가 첫 계단)
  frameColumn(g, 0, U * 2, { midShelf: U });           // 2칸
  frameColumn(g, U, U * 3, { midShelf: U * 1.5, sisal: true }); // 3칸 (스크래쳐 기둥)
  sideStorage(g, U * 1.5 + 0.15, 0.3, U * 2);          // 옆 수납칸
  felt(g, 0, U * 2, '#d8cfc1');
  felt(g, U, U * 3, '#c9b8a3');
  // 위층 연결 받침
  return g;
}
const ORMI_NAV = {
  // 고양이 길: 양 끝이 바닥(y=0)이면 바닥과 이어진 출입구
  path: [
    [-U, 0, 0.62],
    [-U, U, 0],
    [0, U * 2, 0],
    [U, U * 3, 0],
    [U * 1.5 + 0.15, U * 2, 0.02],
    [U * 1.5 + 0.15, 0, 0.62],
  ],
  boxes: [{ floor: [-U, 0, 0.62], inside: [-U, 0.07, -0.02] }],
  bounds: [-U * 1.5 - 0.02, U * 1.5 + 0.31, -U / 2 - 0.02, U / 2 + 0.02],
};

// ---------- 커스텀B 월캣타워 (오르미를 벽을 따라 이어 붙인 형태) ----------
export function buildCustomBModel() {
  const g = new THREE.Group();
  const xA = [-3.5 * U, -2.5 * U, -1.5 * U];
  hideBox(g, xA[0], U);
  frameColumn(g, xA[1], U * 2, { midShelf: U });
  frameColumn(g, xA[2], U * 3, { midShelf: U * 1.5, sisal: true });
  // 가운데 다리 + 아래 수납칸
  const bw = U * 2;
  sideStorage(g, -U / 2, U, U * 2);
  sideStorage(g, U / 2, U, U * 2);
  plank(g, bw + 0.02, T, U + 0.02, 0, U * 3 - T / 2, 0, M.wood(), 0.012);   // 다리 상판
  // 다리 받침 기둥 (뒤쪽, 벽 고정 느낌)
  plank(g, POST, U * 3 - U * 2 - T, POST, -bw / 2 + POST, U * 2 + (U - T) / 2, -U / 2 + POST / 2, M.woodMid(), 0.008);
  plank(g, POST, U * 3 - U * 2 - T, POST, bw / 2 - POST, U * 2 + (U - T) / 2, -U / 2 + POST / 2, M.woodMid(), 0.008);
  // 다리 위 낮은 난간
  plank(g, bw - 0.06, 0.05, 0.03, 0, U * 3 + 0.025, -U / 2 + 0.03, M.woodLight(), 0.012);
  felt(g, 0, U * 3, '#cfc6b8');
  const xB = [1.5 * U, 2.5 * U, 3.5 * U];
  frameColumn(g, xB[0], U * 3, { midShelf: U * 1.5, sisal: true });
  frameColumn(g, xB[1], U * 2, { midShelf: U });
  hideBox(g, xB[2], U);
  // 맨 위 벽선반 (전망대)
  plank(g, U * 1.2, T, U * 0.8, 0, U * 4.3, -U / 2 + U * 0.4, M.wood(), 0.012);
  for (const sx of [-1, 1]) {
    const br = mesh(rbox(0.03, 0.16, U * 0.6, 0.008), M.woodMid(), sx * U * 0.45, U * 4.3 - 0.095, -U / 2 + U * 0.3);
    g.add(br);
  }
  felt(g, 0, U * 4.3, '#e5d9c6');
  return g;
}
const CUSTOMB_NAV = {
  path: [
    [-3.5 * U, 0, 0.62],
    [-3.5 * U, U, 0],
    [-2.5 * U, U * 2, 0],
    [-1.5 * U, U * 3, 0],
    [-0.45 * U, U * 3, 0.02],
    [0, U * 4.3, -0.05],
    [0.45 * U, U * 3, 0.02],
    [1.5 * U, U * 3, 0],
    [2.5 * U, U * 2, 0],
    [3.5 * U, U, 0],
    [3.5 * U, 0, 0.62],
  ],
  boxes: [
    { floor: [-3.5 * U, 0, 0.62], inside: [-3.5 * U, 0.07, -0.02] },
    { floor: [3.5 * U, 0, 0.62], inside: [3.5 * U, 0.07, -0.02] },
  ],
  bounds: [-4 * U - 0.02, 4 * U + 0.02, -U / 2 - 0.02, U / 2 + 0.02],
};

// ---------- 배치 + GLB 교체 ----------
const loader = new GLTFLoader();

export function createProduct(key, { x, z, rotY }) {
  const cfg = CONFIG.products[key];
  const build = key === 'ormi' ? buildOrmiModel : buildCustomBModel;
  const nav = key === 'ormi' ? ORMI_NAV : CUSTOMB_NAV;

  const root = new THREE.Group();
  root.name = key;
  root.position.set(x, 0, z);
  root.rotation.y = rotY;
  root.userData.product = key;

  const visual = build();
  root.add(visual);

  // 누르기 쉬운 투명 판정 상자
  const [x0, x1, z0, z1] = nav.bounds;
  const topY = Math.max(...nav.path.map((p) => p[1])) + 0.1;
  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(x1 - x0, topY, z1 - z0 + 0.1),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hit.position.set((x0 + x1) / 2, topY / 2, (z0 + z1) / 2);
  hit.userData.product = key;
  root.add(hit);

  root.updateMatrixWorld(true);
  const toWorld = (p) => root.localToWorld(new THREE.Vector3(p[0], p[1], p[2]));
  const product = {
    key, root, hit,
    path: nav.path.map(toWorld),
    boxes: nav.boxes.map((b) => ({ floor: toWorld(b.floor), inside: toWorld(b.inside), rotY })),
    rotY,
    obstacle: worldBounds(root, nav.bounds),
  };

  // GLB가 지정되어 있으면 불러와서 교체
  if (cfg.glb) {
    loader.load(cfg.glb, (gltf) => {
      const model = gltf.scene;
      model.scale.setScalar(cfg.scale || 1);
      model.rotation.y = THREE.MathUtils.degToRad(cfg.rotationY || 0);
      model.position.fromArray(cfg.offset || [0, 0, 0]);
      model.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
      root.remove(visual);
      root.add(model);
      console.info(`[고양이서가] ${cfg.name} GLB 로드 완료:`, cfg.glb);
    }, undefined, (err) => {
      console.warn(`[고양이서가] ${cfg.glb} 를 불러오지 못해 기본 모델을 씁니다.`, err);
    });
  }
  return product;
}

function worldBounds(root, [x0, x1, z0, z1]) {
  const pts = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].map(([a, b]) => root.localToWorld(new THREE.Vector3(a, 0, b)));
  return {
    minX: Math.min(...pts.map((p) => p.x)), maxX: Math.max(...pts.map((p) => p.x)),
    minZ: Math.min(...pts.map((p) => p.z)), maxZ: Math.max(...pts.map((p) => p.z)),
  };
}

