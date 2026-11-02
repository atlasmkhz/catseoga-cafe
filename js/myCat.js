// 2단계: 우리 집 고양이 입장시키기
// 사진에서 털색을 뽑아(k-평균) 무늬를 정하고, 주인 곁을 따라다니는 고양이를 만듭니다.
import * as THREE from 'three';
import { CatModel, ANIMS } from './catModel.js';
import { pushOut } from './nav.js';

// ---------- 사진 → 털색 ----------
export async function extractCatColors(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const S = 72;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d', { willReadFrequently: true });
    // 가운데 65%만 (배경 줄이기)
    const side = Math.min(img.width, img.height) * 0.65;
    g.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, S, S);
    const data = g.getImageData(0, 0, S, S).data;
    const px = [];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      // 가운데일수록 많이 반영
      const dx = (x - S / 2) / (S / 2), dy = (y - S / 2) / (S / 2);
      const w = Math.max(0, 1 - (dx * dx + dy * dy));
      if (Math.random() > w) continue;
      const i = (y * S + x) * 4;
      px.push([data[i] / 255, data[i + 1] / 255, data[i + 2] / 255]);
    }
    const clusters = kmeans(px, 4);
    return decide(clusters);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function kmeans(px, k) {
  let cs = [];
  for (let i = 0; i < k; i++) cs.push(px[Math.floor((i + 0.5) / k * px.length)] || [0.5, 0.5, 0.5]);
  // 밝기순 정렬된 점에서 시작하면 더 안정적
  const sorted = [...px].sort((a, b) => lum(a) - lum(b));
  cs = cs.map((_, i) => sorted[Math.floor((i + 0.5) / k * sorted.length)] || [0.5, 0.5, 0.5]);
  let assign = new Array(px.length).fill(0);
  for (let it = 0; it < 10; it++) {
    for (let i = 0; i < px.length; i++) {
      let bd = 1e9, bi = 0;
      for (let j = 0; j < k; j++) { const d = dist(px[i], cs[j]); if (d < bd) { bd = d; bi = j; } }
      assign[i] = bi;
    }
    const sum = cs.map(() => [0, 0, 0, 0]);
    px.forEach((p, i) => { const s = sum[assign[i]]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; });
    cs = sum.map((s, j) => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : cs[j]));
  }
  const counts = cs.map(() => 0);
  assign.forEach((a) => counts[a]++);
  return cs.map((c, i) => ({ c, share: counts[i] / px.length })).filter((x) => x.share > 0.03).sort((a, b) => b.share - a.share);
}
const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
const dist = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const toHex = (c) => '#' + new THREE.Color(c[0], c[1], c[2]).getHexString();

function hsl(c) { const o = {}; new THREE.Color(c[0], c[1], c[2]).getHSL(o); return o; }

function decide(clusters) {
  const isWhite = (x) => { const h = hsl(x.c); return h.l > 0.72 && h.s < 0.35; };
  const isOrange = (x) => { const h = hsl(x.c); return h.h > 0.03 && h.h < 0.13 && h.s > 0.3 && h.l > 0.3 && h.l < 0.8; };
  const isDark = (x) => lum(x.c) < 0.22;
  const whiteShare = clusters.filter(isWhite).reduce((s, x) => s + x.share, 0);
  const colored = clusters.filter((x) => !isWhite(x));
  let base, accent, pattern = 'custom', white = whiteShare > 0.15, patches = false;
  if (!colored.length || whiteShare > 0.7) {
    base = '#f7f3ec'; accent = colored[0] ? toHex(colored[0].c) : '#e0d6c8';
    white = false;
  } else {
    base = toHex(colored[0].c);
    const other = colored.slice(1).find((x) => Math.sqrt(dist(x.c, colored[0].c)) > 0.12);
    accent = other ? toHex(other.c) : new THREE.Color(base).offsetHSL(0, 0, -0.18).getStyle();
    // 흰색 + 주황 + 검정이 모두 있으면 삼색 얼룩
    if (white && clusters.some(isOrange) && clusters.some(isDark)) patches = true;
  }
  // 아주 진한 단색이면 줄무늬 없이
  const b = new THREE.Color(base), a = new THREE.Color(accent);
  const contrast = Math.abs(b.getHSL({}).l - a.getHSL({}).l);
  const stripes = !patches && contrast > 0.08 && lum([b.r, b.g, b.b]) > 0.12;
  if (patches) {
    const orange = clusters.find(isOrange), dark = clusters.find(isDark);
    return { pattern, base: '#fbf5ec', dark: toHex(dark.c), orange: toHex(orange.c), light: '#fbf5ec', patches: true, stripes: false, white: true, whiteAmount: 1, eye: '#9cb35a', swatches: clusters.map((x) => toHex(x.c)) };
  }
  const light = white ? '#fbf6ee' : new THREE.Color(base).offsetHSL(0, -0.05, 0.12).getStyle();
  return {
    pattern, base, dark: toHex([a.r, a.g, a.b]), light, stripes, white, whiteAmount: Math.min(0.8, whiteShare * 1.6),
    eye: lum([b.r, b.g, b.b]) < 0.2 ? '#e3c43a' : '#b6a443',
    swatches: clusters.map((x) => toHex(x.c)),
  };
}

// ---------- 주인을 따라다니는 내 고양이 ----------
const angDamp = (a, b, k, dt) => {
  const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * (1 - Math.exp(-k * dt));
};

export class FollowerCat {
  constructor(scene, room, info, ownerName) {
    this.scene = scene; this.room = room; this.info = info;
    this.model = new CatModel('custom', info, 9, 1.05);
    this.hit = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    this.hit.position.y = 0.25;
    this.hit.userData.followerOf = ownerName;
    this.model.root.add(this.hit);
    scene.add(this.model.root);
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.anim = 'idle';
    this.idleT = 0;
    this.restPose = 'sit';
    this.netTarget = null;
    this.placed = false;
  }

  // 주인 위치를 받아 따라감 (내 고양이일 때)
  simulate(dt, owner, ownerYaw) {
    if (!this.placed) { this.pos.copy(owner).add(new THREE.Vector3(0.6, 0, 0.3)).setY(0); pushOut(this.room, this.pos, 0.14); this.placed = true; }
    const side = new THREE.Vector3(Math.cos(ownerYaw) * 0.55, 0, -Math.sin(ownerYaw) * 0.55);
    const want = owner.clone().setY(0).add(side).add(new THREE.Vector3(Math.sin(ownerYaw) * 0.15, 0, Math.cos(ownerYaw) * 0.15));
    pushOut(this.room, want, 0.14);
    const d = want.sub(this.pos); d.y = 0;
    const dist = d.length();
    let speed = 0;
    if (dist > (this.anim === 'walk' ? 0.12 : 0.5)) {
      speed = Math.min(1.5, 0.4 + dist * 1.2);
      const yaw = Math.atan2(d.x, d.z);
      this.yaw = angDamp(this.yaw, yaw, 9, dt);
      this.pos.addScaledVector(d.normalize(), speed * dt * Math.max(0, Math.cos(yaw - this.yaw)));
      pushOut(this.room, this.pos, 0.13);
      this.anim = 'walk';
      this.idleT = 0;
    } else {
      this.idleT += dt;
      const look = Math.atan2(owner.x - this.pos.x, owner.z - this.pos.z);
      this.yaw = angDamp(this.yaw, look, 3, dt);
      if (this.idleT > 6 && this.anim !== this.restPose) {
        this.restPose = ['loaf', 'sleep', 'groom', 'sit'][Math.floor(Math.random() * 4)];
      }
      this.anim = this.idleT < 1.5 ? 'idle' : this.idleT < 6 ? 'sit' : this.restPose;
    }
    this.pos.y = 0;
    this.speed = speed;
    this.apply(dt);
  }

  // 다른 손님의 고양이일 때: 받은 위치로 부드럽게
  follow(dt) {
    if (!this.netTarget) return;
    const before = this.pos.clone();
    if (!this.placed || this.pos.distanceTo(this.netTarget.pos) > 3) { this.pos.copy(this.netTarget.pos); this.placed = true; }
    this.pos.lerp(this.netTarget.pos, 1 - Math.exp(-8 * dt));
    this.yaw = angDamp(this.yaw, this.netTarget.yaw, 8, dt);
    this.anim = this.netTarget.anim;
    this.speed = before.distanceTo(this.pos) / Math.max(dt, 1e-3);
    this.apply(dt);
  }

  apply(dt) {
    this.model.root.position.copy(this.pos);
    this.model.root.rotation.y = this.yaw;
    this.model.setAnim(this.anim);
    this.model.update(dt, this.speed || 0);
  }

  state() { return [+this.pos.x.toFixed(2), +this.pos.z.toFixed(2), +this.yaw.toFixed(2), ANIMS.indexOf(this.anim)]; }
  setState(a) {
    this.netTarget = { pos: new THREE.Vector3(a[0], 0, a[1]), yaw: a[2], anim: ANIMS[a[3]] || 'idle' };
  }

  dispose() { this.scene.remove(this.model.root); }
}
