// 떠오르는 하트 · zzz · 글자 효과
import * as THREE from 'three';
import { textSprite } from './kit.js';

function heartTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ff7b8a';
  g.beginPath();
  g.moveTo(32, 54);
  g.bezierCurveTo(4, 36, 6, 10, 22, 10);
  g.bezierCurveTo(28, 10, 32, 15, 32, 20);
  g.bezierCurveTo(32, 15, 36, 10, 42, 10);
  g.bezierCurveTo(58, 10, 60, 36, 32, 54);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.beginPath(); g.ellipse(22, 22, 5, 3.5, -0.6, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.heartMat = new THREE.SpriteMaterial({ map: heartTexture(), transparent: true, depthWrite: false });
  }
  hearts(pos, n = 3) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(this.heartMat.clone());
      const sz = 0.12 + Math.random() * 0.06;
      s.scale.set(sz, sz, 1);
      s.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.25, 0.1, (Math.random() - 0.5) * 0.25));
      s.renderOrder = 20;
      this.scene.add(s);
      this.items.push({ o: s, life: 1.6 + Math.random() * 0.5, age: -i * 0.18, vy: 0.45 + Math.random() * 0.2, wob: Math.random() * 6, base: sz });
    }
  }
  zzz(pos) {
    const s = textSprite('z', { height: 0.13, bg: 'rgba(0,0,0,0)', color: '#8aa0c8', font: '700 52px "Jua", sans-serif' });
    s.position.copy(pos).add(new THREE.Vector3(0.08, 0.12, 0));
    this.scene.add(s);
    this.items.push({ o: s, life: 2.2, age: 0, vy: 0.18, wob: Math.random() * 6, base: 0.13, drift: 0.08, dispose: true });
  }
  text(pos, str, color = '#c66b3d') {
    const s = textSprite(str, { height: 0.16, color, border: 'rgba(198,107,61,0.25)' });
    s.position.copy(pos).add(new THREE.Vector3(0, 0.25, 0));
    this.scene.add(s);
    this.items.push({ o: s, life: 1.6, age: 0, vy: 0.2, wob: 0, base: 0.16, dispose: true });
  }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.age += dt;
      if (it.age < 0) { it.o.visible = false; continue; }
      it.o.visible = true;
      it.o.position.y += it.vy * dt;
      it.o.position.x += Math.sin(it.age * 4 + it.wob) * 0.002 + (it.drift || 0) * dt;
      const k = it.age / it.life;
      it.o.material.opacity = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.6) / 0.4);
      const pop = k < 0.15 ? 0.6 + k / 0.15 * 0.4 : 1;
      const ratio = it.o.scale.x / it.o.scale.y;
      it.o.scale.set(it.base * pop * ratio, it.base * pop, 1);
      if (k >= 1) {
        this.scene.remove(it.o);
        if (it.dispose) it.o.material.map.dispose();
        it.o.material.dispose();
        this.items.splice(i, 1);
      }
    }
  }
}
