// 귀여운 고양이 모델 (꼭짓점 색으로 무늬를 칠하고, 자세는 코드로 움직임)
import * as THREE from 'three';
import { fbm3 } from './kit.js';

export const PALETTES = {
  cheese:   { base: '#e9a245', dark: '#c4701f', light: '#fbe4bd', eye: '#c9a13b' },
  calico:   { base: '#fbf5ec', dark: '#2c2523', light: '#fbf5ec', orange: '#e48f3c', eye: '#8fae4e' },
  mackerel: { base: '#8f8a82', dark: '#3d3935', light: '#e2dccf', eye: '#a7b04a' },
  tuxedo:   { base: '#272323', dark: '#1a1717', light: '#fbf7f0', eye: '#d6b43a' },
  black:    { base: '#221e1e', dark: '#141212', light: '#2e2828', eye: '#e3c43a' },
};

const tmp = new THREE.Color();
const cA = new THREE.Color(), cB = new THREE.Color(), cC = new THREE.Color(), cO = new THREE.Color();

// 무늬 함수: part 이름, 단위구 좌표(p), 반환 Color
function makePainter(pattern, pal, seed = 1) {
  cA.set(pal.base); cB.set(pal.dark); cC.set(pal.light);
  const base = cA.clone(), dark = cB.clone(), light = cC.clone();
  const orange = new THREE.Color(pal.orange || pal.base);
  const s = seed * 3.7;
  const stripes = pal.stripes ?? (pattern === 'cheese' || pattern === 'mackerel');
  const whiteBelly = pal.white ?? (pattern === 'cheese' || pattern === 'mackerel' || pattern === 'tuxedo' || pattern === 'calico');
  const whiteAmount = pattern === 'tuxedo' ? 0.75 : pattern === 'calico' ? 1.0 : (pal.whiteAmount ?? 0.45);

  return (part, p, out) => {
    out.copy(base);
    const n = fbm3(p.x * 2.2 + s, p.y * 2.2, p.z * 2.2 - s);
    if (pattern === 'calico' || pal.patches) {
      const a = fbm3(p.x * 1.6 + 10 + s, p.y * 1.6, p.z * 1.6);
      const b = fbm3(p.x * 1.7 - 7, p.y * 1.7 + s, p.z * 1.7 + 3);
      const top = part === 'belly' ? -1 : p.y;
      if (top > -0.35 && a > 0.55) out.copy(orange);
      if (top > -0.2 && b > 0.6) out.copy(dark);
    }
    if (stripes) {
      let v = 0;
      if (part === 'body') v = Math.sin(p.z * 9 + n * 3.5);
      else if (part === 'head') v = p.y > 0.25 && p.z < 0.75 ? Math.sin(p.x * 12 + n * 2) : -1;
      else if (part === 'leg') v = Math.sin(p.y * 10 + n * 2);
      else if (part === 'tail') v = Math.sin(p.y * 6);
      const backness = part === 'body' ? THREE.MathUtils.smoothstep(p.y, -0.55, 0.1) : 1;
      if (v > 0.25 && backness > 0.3) out.lerp(dark, 0.85 * backness);
    }
    if (whiteBelly) {
      let w = 0;
      if (part === 'body') w = THREE.MathUtils.smoothstep(-p.y + p.z * 0.45 * whiteAmount, 0.45 - whiteAmount * 0.3, 0.75 - whiteAmount * 0.3);
      if (part === 'head') w = THREE.MathUtils.smoothstep(p.z * 0.9 - p.y * 0.9, 0.75 - whiteAmount * 0.25, 1.0 - whiteAmount * 0.25) * (Math.abs(p.x) < 0.55 + whiteAmount * 0.2 ? 1 : 0);
      if (part === 'paw') w = whiteAmount > 0.6 ? 1 : 0.6;
      if (part === 'leg') w = THREE.MathUtils.smoothstep(-p.y, 0.1 + (1 - whiteAmount) * 0.6, 0.5 + (1 - whiteAmount) * 0.4);
      if (part === 'tail') w = pattern === 'tuxedo' && p.y > 0.92 ? 1 : 0;
      if (pattern === 'calico') {
        // 삼색이는 배 · 주둥이 · 발만 확실하게 흰색
        if (part === 'body' && p.y < -0.25) w = 1;
      }
      if (w > 0) out.lerp(light, w);
    }
    // 아주 옅은 털 얼룩
    out.offsetHSL(0, 0, (n - 0.5) * 0.05);
    return out;
  };
}

function paint(geo, part, painter) {
  const pos = geo.attributes.position;
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const c = new THREE.Vector3(); bb.getCenter(c);
  const sz = new THREE.Vector3(); bb.getSize(sz);
  const cols = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.set((pos.getX(i) - c.x) / (sz.x / 2 || 1), (pos.getY(i) - c.y) / (sz.y / 2 || 1), (pos.getZ(i) - c.z) / (sz.z / 2 || 1));
    painter(part, p, tmp);
    cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return geo;
}

const furMat = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
const pinkMat = new THREE.MeshStandardMaterial({ color: '#f2a5a0', roughness: 0.7 });
const blackMat = new THREE.MeshStandardMaterial({ color: '#1a1414', roughness: 0.3 });
const whiteMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });

function m(geo, mat, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

const lerp = THREE.MathUtils.lerp;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));

// 자세별 목표값
const POSES = {
  idle:    { bodyY: 0.2, pitch: 0, fold: 0, rear: 0, head: 0, tail: 0.5, eyes: 1, stretch: 0, curl: 0 },
  walk:    { bodyY: 0.2, pitch: 0, fold: 0, rear: 0, head: 0.05, tail: 0.35, eyes: 1, stretch: 0, curl: 0 },
  sit:     { bodyY: 0.21, pitch: -0.55, fold: 0, rear: 1, head: -0.2, tail: 0.9, eyes: 1, stretch: 0, curl: 0 },
  loaf:    { bodyY: 0.135, pitch: 0, fold: 1, rear: 0, head: -0.05, tail: 1, eyes: 0.6, stretch: 0, curl: 0.3 },
  sleep:   { bodyY: 0.12, pitch: 0.05, fold: 1, rear: 0, head: 0.45, tail: 1.3, eyes: 0, stretch: 0, curl: 1 },
  stretch: { bodyY: 0.17, pitch: 0.32, fold: 0, rear: 0, head: -0.35, tail: -0.2, eyes: 0.4, stretch: 1, curl: 0 },
  eat:     { bodyY: 0.18, pitch: 0.25, fold: 0, rear: 0, head: 0.75, tail: 0.3, eyes: 0.5, stretch: 0, curl: 0 },
  petted:  { bodyY: 0.135, pitch: 0, fold: 1, rear: 0, head: -0.25, tail: 1, eyes: 0.05, stretch: 0, curl: 0.1 },
  groom:   { bodyY: 0.21, pitch: -0.55, fold: 0, rear: 1, head: 0.3, tail: 0.9, eyes: 0.3, stretch: 0, curl: 0 },
  jump:    { bodyY: 0.2, pitch: -0.1, fold: 0.3, rear: 0, head: -0.1, tail: -0.1, eyes: 1, stretch: 0.4, curl: 0 },
};
export const ANIMS = Object.keys(POSES);

export class CatModel {
  constructor(pattern, palette, seed = 1, size = 1) {
    const pal = palette || PALETTES[pattern];
    const painter = makePainter(pattern, pal, seed);
    this.root = new THREE.Group();
    this.inner = new THREE.Group();     // 몸 기울기용
    this.root.add(this.inner);
    this.root.scale.setScalar(size);
    const mat = furMat();

    // 몸통
    const bodyGeo = paint(new THREE.SphereGeometry(1, 30, 22).scale(0.15, 0.135, 0.23), 'body', painter);
    this.body = m(bodyGeo, mat);
    this.bodyPivot = new THREE.Group();
    this.bodyPivot.add(this.body);
    this.inner.add(this.bodyPivot);
    // 엉덩이 (통통하게)
    const hipGeo = paint(new THREE.SphereGeometry(1, 22, 16).scale(0.15, 0.14, 0.14), 'body', painter);
    this.hip = m(hipGeo, mat, 0, 0.0, -0.1);
    this.body.add(this.hip);

    // 머리
    this.neck = new THREE.Group();
    this.neck.position.set(0, 0.1, 0.17);
    this.body.add(this.neck);
    this.head = new THREE.Group();
    this.neck.add(this.head);
    const headGeo = paint(new THREE.SphereGeometry(1, 30, 22).scale(0.135, 0.118, 0.12), 'head', painter);
    this.head.add(m(headGeo, mat));
    const cheekGeo = paint(new THREE.SphereGeometry(1, 16, 12).scale(0.075, 0.06, 0.06), 'head', painter);
    for (const s of [-1, 1]) this.head.add(m(cheekGeo, mat, s * 0.065, -0.04, 0.04));
    // 주둥이
    const muzzleCol = new THREE.Color(pal.light);
    if (pattern === 'black') muzzleCol.set(pal.base).offsetHSL(0, 0, 0.04);
    if (pattern === 'mackerel' || pattern === 'cheese') muzzleCol.lerp(new THREE.Color(pal.base), 0.25);
    const muzzleMat = new THREE.MeshStandardMaterial({ color: muzzleCol, roughness: 0.9 });
    for (const s of [-1, 1]) this.head.add(m(new THREE.SphereGeometry(0.032, 12, 10), muzzleMat, s * 0.025, -0.045, 0.1));
    this.head.add(m(new THREE.SphereGeometry(0.014, 10, 8).scale(1.3, 0.9, 1), pinkMat, 0, -0.022, 0.12));
    // 귀
    const earGeo = paint(new THREE.ConeGeometry(0.052, 0.1, 12).translate(0, 0.05, 0), 'head', painter);
    const innerEarGeo = new THREE.ConeGeometry(0.033, 0.07, 10).translate(0, 0.035, 0);
    this.ears = [];
    for (const s of [-1, 1]) {
      const e = new THREE.Group();
      e.position.set(s * 0.07, 0.075, -0.01);
      e.rotation.set(-0.15, 0, -s * 0.38);
      const outer = m(earGeo, mat);
      outer.scale.z = 0.6;
      e.add(outer);
      const inner = m(innerEarGeo, pinkMat, 0, 0.005, 0.014);
      inner.scale.z = 0.4;
      e.add(inner);
      this.head.add(e);
      this.ears.push(e);
    }
    // 눈
    const irisMat = new THREE.MeshStandardMaterial({ color: pal.eye || '#c9a13b', roughness: 0.25 });
    this.eyes = [];
    for (const s of [-1, 1]) {
      const eg = new THREE.Group();
      eg.position.set(s * 0.052, 0.012, 0.097);
      eg.rotation.y = s * 0.35;
      const iris = m(new THREE.SphereGeometry(0.024, 14, 12), irisMat);
      iris.scale.set(1, 1.1, 0.55);
      eg.add(iris);
      const pupil = m(new THREE.SphereGeometry(0.017, 12, 10), blackMat, 0, 0, 0.008);
      pupil.scale.set(0.85, 1.15, 0.6);
      eg.add(pupil);
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), whiteMat);
      hl.position.set(s * -0.006 + 0.004, 0.009, 0.018);
      eg.add(hl);
      this.head.add(eg);
      this.eyes.push(eg);
    }
    // 수염
    const wv = [];
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      wv.push(s * 0.05, -0.04 + i * 0.008, 0.11, s * 0.17, -0.03 + (i - 1) * 0.025, 0.08);
    }
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wv, 3));
    const whisk = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: pattern === 'black' || pattern === 'tuxedo' ? '#e8e2d8' : '#fffaf2', transparent: true, opacity: 0.8 }));
    this.head.add(whisk);

    // 다리
    const legGeo = paint(new THREE.CapsuleGeometry(0.036, 0.09, 4, 10).translate(0, -0.06, 0), 'leg', painter);
    const pawGeo = paint(new THREE.SphereGeometry(0.04, 12, 10).scale(1, 0.7, 1.15), 'paw', painter);
    this.legs = [];
    const legPos = [[-0.072, -0.03, 0.13, 'f'], [0.072, -0.03, 0.13, 'f'], [-0.08, -0.03, -0.13, 'b'], [0.08, -0.03, -0.13, 'b']];
    for (const [x, y, z, k] of legPos) {
      const hip = new THREE.Group();
      hip.position.set(x, y, z);
      const leg = m(legGeo, mat);
      hip.add(leg);
      const paw = m(pawGeo, mat, 0, -0.14, 0.012);
      hip.add(paw);
      this.body.add(hip);
      this.legs.push({ hip, kind: k, side: Math.sign(x) });
    }

    // 꼬리 (마디 연결)
    this.tail = [];
    let parent = new THREE.Group();
    parent.position.set(0, 0.04, -0.21);
    this.body.add(parent);
    const N = 8;
    for (let i = 0; i < N; i++) {
      const r = 0.032 - i * 0.0015;
      const segGeo = paint(new THREE.CapsuleGeometry(r, 0.035, 3, 8).translate(0, 0.03, 0), 'tail', (part, p, out) => painter('tail', new THREE.Vector3(p.x, (i + (p.y + 1) / 2) / N, p.z), out));
      const seg = new THREE.Group();
      if (i > 0) seg.position.y = 0.045;
      seg.add(m(segGeo, mat));
      parent.add(seg);
      this.tail.push(seg);
      parent = seg;
    }
    this.tail[0].rotation.x = -2.2;

    this.cur = { ...POSES.idle };
    this.anim = 'idle';
    this.phase = Math.random() * 10;
    this.t = Math.random() * 10;
    this.blink = 0;
    this.lookYaw = 0;
  }

  setAnim(a) { if (POSES[a]) this.anim = a; }

  update(dt, speed = 0) {
    const P = POSES[this.anim] || POSES.idle;
    const c = this.cur;
    for (const k in P) c[k] = damp(c[k], P[k], 7, dt);
    this.t += dt;
    const walking = speed > 0.05 && this.anim === 'walk';
    this.phase += dt * (walking ? 6 + speed * 9 : 0);
    const sw = walking ? Math.sin(this.phase) : 0;

    // 몸 높이 · 숨쉬기
    const breathe = Math.sin(this.t * (this.anim === 'sleep' ? 1.6 : 2.6)) * 0.004;
    this.bodyPivot.position.y = c.bodyY + Math.abs(sw) * 0.012 + breathe;
    this.bodyPivot.rotation.x = c.pitch * 0.55;
    this.body.position.y = 0;
    this.body.position.z = -c.rear * 0.04;
    const sc = 1 + breathe * 3;
    this.body.scale.set(sc, sc, 1 - c.curl * 0.12);
    this.bodyPivot.rotation.z = c.curl * 0.12;

    // 머리
    const headBob = this.anim === 'groom' ? Math.sin(this.t * 6) * 0.15 : 0;
    this.neck.rotation.x = c.head - c.pitch * 0.5 + headBob;
    this.neck.rotation.y = damp(this.neck.rotation.y, this.lookYaw + c.curl * 0.9 + (this.anim === 'groom' ? 0.8 : 0), 4, dt);
    this.neck.rotation.z = this.anim === 'petted' ? Math.sin(this.t * 1.5) * 0.15 + 0.15 : c.curl * 0.3;
    this.neck.position.y = 0.1 - c.curl * 0.05 - c.fold * 0.015;
    this.neck.position.z = 0.17 - c.curl * 0.02;

    // 눈 깜빡임
    this.blink -= dt;
    if (this.blink < -3 - Math.random() * 3) this.blink = 0.14;
    const open = c.eyes * (this.blink > 0 ? 0.1 : 1);
    for (const e of this.eyes) e.scale.y = Math.max(0.08, open);
    // 귀 쫑긋
    const twitch = Math.sin(this.t * 0.7) > 0.97 ? 0.3 : 0;
    this.ears.forEach((e, i) => { e.rotation.x = -0.15 - (i ? twitch : 0); });

    // 다리
    for (const L of this.legs) {
      const front = L.kind === 'f';
      const offs = (front ? 0 : Math.PI) + (L.side > 0 ? Math.PI : 0);
      let rx = walking ? Math.sin(this.phase + offs) * 0.55 : 0;
      if (front) rx += c.pitch * 0.55 - c.stretch * 1.0;
      else rx += c.pitch * 0.55 - c.rear * 1.35 + c.stretch * 0.3;
      L.hip.rotation.x = rx;
      const tuck = c.fold;
      L.hip.scale.y = 1 - tuck * 0.65;
      L.hip.position.y = -0.03 + tuck * 0.06 + (front ? 0 : c.rear * 0.035);
      L.hip.rotation.z = 0;
      if (!front && c.rear > 0.5) L.hip.rotation.z = L.side * 0.3 * c.rear;
    }

    // 꼬리
    const wave = this.t * (this.anim === 'walk' ? 3 : 1.4);
    const curl = c.tail;
    this.tail[0].rotation.x = -2.0 + curl * 0.9 + c.pitch * 0.4;
    this.tail[0].rotation.z = c.curl * 0.6;
    this.tail.forEach((s, i) => {
      if (i === 0) return;
      s.rotation.x = -0.12 * curl + Math.sin(wave + i * 0.6) * 0.04;
      s.rotation.z = Math.sin(wave - i * 0.5) * (0.12 + (1 - c.curl) * 0.08) + c.curl * 0.32 + (this.anim === 'loaf' || this.anim === 'petted' ? 0.2 : 0);
    });
  }

  headWorld(out = new THREE.Vector3()) {
    return this.head.getWorldPosition(out);
  }
}
