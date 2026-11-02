// 공용 재료 · 텍스처 · 도형 도우미 (따뜻한 미니어처 디오라마 톤)
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 820);

// ---------- 작은 난수 · 노이즈 ----------
export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash3(x, y, z) {
  let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
const fade = (t) => t * t * (3 - 2 * t);
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), xf), l(c(0, 1, 0), c(1, 1, 0), xf), yf),
    l(l(c(0, 0, 1), c(1, 0, 1), xf), l(c(0, 1, 1), c(1, 1, 1), xf), yf),
    zf);
}
export function fbm3(x, y, z) {
  return noise3(x, y, z) * 0.6 + noise3(x * 2.1, y * 2.1, z * 2.1) * 0.3 + noise3(x * 4.3, y * 4.3, z * 4.3) * 0.1;
}

// ---------- 캔버스 텍스처 ----------
function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  return t;
}

function shade(hex, amt) {
  const c = new THREE.Color(hex);
  const hsl = {}; c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)));
  return '#' + c.getHexString();
}

// 원목 결 텍스처
export function woodTexture(base = '#d8b07c', seed = 1, repeat = [1, 1]) {
  const rnd = mulberry(seed);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const y = rnd() * h;
      const amp = 2 + rnd() * 6;
      const f = 0.01 + rnd() * 0.03;
      const ph = rnd() * 10;
      g.strokeStyle = rnd() < 0.5 ? shade(base, -0.06 - rnd() * 0.06) : shade(base, 0.04);
      g.globalAlpha = 0.25 + rnd() * 0.35;
      g.lineWidth = 0.6 + rnd() * 1.6;
      g.beginPath();
      for (let x = 0; x <= w; x += 4) {
        const yy = y + Math.sin(x * f + ph) * amp;
        x === 0 ? g.moveTo(x, yy) : g.lineTo(x, yy);
      }
      g.stroke();
    }
    // 옹이 몇 개
    g.globalAlpha = 0.35;
    for (let i = 0; i < 2; i++) {
      const x = rnd() * w, y = rnd() * h;
      for (let r = 9; r > 1; r -= 2.5) {
        g.strokeStyle = shade(base, -0.12);
        g.beginPath(); g.ellipse(x, y, r * 1.8, r * 0.7, 0, 0, Math.PI * 2); g.stroke();
      }
    }
    g.globalAlpha = 1;
  }, repeat);
}

// 마루 바닥 (판자 이음매 포함)
export function floorTexture() {
  const rnd = mulberry(7);
  return canvasTex(1024, 1024, (g, w, h) => {
    const rows = 8;
    const rh = h / rows;
    const tones = ['#c99764', '#d2a26e', '#c08c59', '#d8ab78', '#c6935f'];
    for (let r = 0; r < rows; r++) {
      let x = -rnd() * 300;
      while (x < w) {
        const len = 260 + rnd() * 320;
        const base = tones[Math.floor(rnd() * tones.length)];
        g.fillStyle = base;
        g.fillRect(x, r * rh, len, rh);
        for (let i = 0; i < 14; i++) {
          const y = r * rh + rnd() * rh;
          g.strokeStyle = shade(base, -0.07);
          g.globalAlpha = 0.3;
          g.lineWidth = 1 + rnd() * 2;
          g.beginPath();
          g.moveTo(x, y);
          g.bezierCurveTo(x + len * 0.3, y + (rnd() - 0.5) * 10, x + len * 0.7, y + (rnd() - 0.5) * 10, x + len, y);
          g.stroke();
        }
        g.globalAlpha = 1;
        g.fillStyle = 'rgba(80,45,20,0.55)';
        g.fillRect(x, r * rh, 3, rh);
        x += len;
      }
      g.fillStyle = 'rgba(80,45,20,0.5)';
      g.fillRect(0, r * rh, w, 3);
    }
  }, [3, 3]);
}

// 회벽
export function plasterTexture(base = '#f3e7d4') {
  const rnd = mulberry(3);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(120,90,60,0.05)';
      const s = 1 + rnd() * 3;
      g.fillRect(rnd() * w, rnd() * h, s, s);
    }
  }, [4, 2]);
}

// 패브릭 (소파 · 방석)
export function fabricTexture(base = '#9db38e') {
  const rnd = mulberry(11);
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      g.fillStyle = `rgba(255,255,255,${0.03 + rnd() * 0.04})`;
      g.fillRect(0, y, w, 1);
    }
    for (let x = 0; x < w; x += 2) {
      g.fillStyle = `rgba(0,0,0,${0.02 + rnd() * 0.04})`;
      g.fillRect(x, 0, 1, h);
    }
  }, [2, 2]);
}

// 둥근 러그
export function rugTexture() {
  return canvasTex(512, 512, (g, w, h) => {
    const cx = w / 2, cy = h / 2;
    const rings = ['#e9d6b9', '#d9a77e', '#efe2cc', '#c98e6a', '#efe2cc', '#e2c49d'];
    for (let i = 0; i < 18; i++) {
      g.fillStyle = rings[i % rings.length];
      g.beginPath(); g.arc(cx, cy, w / 2 - i * 14, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 300; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * w / 2;
      g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1, 0, Math.PI * 2); g.stroke();
    }
  });
}

// ---------- 재료 ----------
const cache = {};
export const M = {
  wood: () => cache.wood ||= new THREE.MeshStandardMaterial({ map: woodTexture('#dcb684', 2), roughness: 0.72 }),
  woodLight: () => cache.woodLight ||= new THREE.MeshStandardMaterial({ map: woodTexture('#e8c99a', 5), roughness: 0.7 }),
  woodDark: () => cache.woodDark ||= new THREE.MeshStandardMaterial({ map: woodTexture('#9a6a42', 9), roughness: 0.7 }),
  woodMid: () => cache.woodMid ||= new THREE.MeshStandardMaterial({ map: woodTexture('#c4935f', 4), roughness: 0.7 }),
  color: (hex, rough = 0.85, extra = {}) => new THREE.MeshStandardMaterial({ color: hex, roughness: rough, ...extra }),
  fabric: (hex) => new THREE.MeshStandardMaterial({ map: fabricTexture(hex), roughness: 0.95 }),
};

// ---------- 도형 ----------
const geoCache = new Map();
export function rbox(w, h, d, r = 0.02, seg = 2) {
  const key = [w, h, d, r, seg].map((v) => v.toFixed(3)).join('|');
  if (!geoCache.has(key)) {
    const rr = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
    geoCache.set(key, new RoundedBoxGeometry(w, h, d, seg, Math.max(rr, 0.001)));
  }
  return geoCache.get(key);
}

export function mesh(geo, mat, x = 0, y = 0, z = 0, opts = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = opts.cast !== false;
  m.receiveShadow = opts.receive !== false;
  return m;
}

// 판자 하나 (바닥 기준이 아닌 중심 좌표)
export function plank(parent, w, h, d, x, y, z, mat, r = 0.012) {
  const m = mesh(rbox(w, h, d, r), mat, x, y, z);
  parent.add(m);
  return m;
}

// 이름표 · 말풍선용 캔버스 스프라이트
export function textSprite(text, opts = {}) {
  const font = opts.font || '600 44px "Gowun Dodum", "Jua", sans-serif';
  const pad = 22;
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = font;
  const tw = Math.ceil(g.measureText(text).width);
  c.width = tw + pad * 2; c.height = 76;
  g.font = font;
  g.fillStyle = opts.bg || 'rgba(255,250,242,0.92)';
  const r = 34;
  g.beginPath();
  g.roundRect(2, 4, c.width - 4, c.height - 8, r);
  g.fill();
  if (opts.border) { g.strokeStyle = opts.border; g.lineWidth = 3; g.stroke(); }
  g.fillStyle = opts.color || '#5a3d2b';
  g.textBaseline = 'middle';
  g.textAlign = 'center';
  g.fillText(text, c.width / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true, sizeAttenuation: !opts.screen });
  const s = new THREE.Sprite(mat);
  const hgt = opts.height || 0.2;
  s.scale.set(hgt * c.width / c.height, hgt, 1);
  s.renderOrder = 10;
  return s;
}
