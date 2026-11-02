// 손님 캐릭터 (작고 동글동글한 사람)
import * as THREE from 'three';
import { textSprite } from './kit.js';

export const LOOKS = {
  tops: ['#e8a87c', '#9fb7a0', '#c9b6e4', '#f2d16b', '#8fb2d6', '#e58f8f', '#f4efe6'],
  hairs: ['#3b2a22', '#6b4630', '#a8784f', '#2b2b30', '#d9b98a'],
  skins: ['#f7dcc5', '#efc9a8', '#d9a982', '#b98563'],
};

const std = (c, r = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
const lerp = THREE.MathUtils.lerp;

export class Avatar {
  constructor(name, look) {
    this.look = { top: LOOKS.tops[0], hair: LOOKS.hairs[0], skin: LOOKS.skins[0], ...look };
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    const skin = std(this.look.skin, 0.7);
    const top = std(this.look.top, 0.95);
    const pants = std('#6d5a4c', 0.9);
    const hair = std(this.look.hair, 0.75);
    const S = (o) => { o.castShadow = true; o.receiveShadow = true; return o; };

    // 다리
    this.legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(s * 0.075, 0.38, 0);
      const leg = S(new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.22, 4, 10), pants));
      leg.position.y = -0.17;
      hip.add(leg);
      const shoe = S(new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), std('#4d3a30', 0.6)));
      shoe.scale.set(1, 0.6, 1.4);
      shoe.position.set(0, -0.34, 0.03);
      hip.add(shoe);
      this.body.add(hip);
      this.legs.push(hip);
    }
    // 몸통 (스웨터)
    const torso = S(new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.18, 6, 16), top));
    torso.position.y = 0.55;
    torso.scale.set(1, 1, 0.82);
    this.body.add(torso);
    // 목도리 느낌의 칼라
    const collar = S(new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 8, 20), std(new THREE.Color(this.look.top).offsetHSL(0, 0, -0.12), 0.95)));
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.73;
    this.body.add(collar);
    // 팔
    this.arms = [];
    for (const s of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(s * 0.17, 0.68, 0);
      const arm = S(new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.2, 4, 10), top));
      arm.position.y = -0.13;
      sh.add(arm);
      const hand = S(new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), skin));
      hand.position.y = -0.27;
      sh.add(hand);
      sh.rotation.z = s * 0.12;
      this.body.add(sh);
      this.arms.push(sh);
    }
    // 머리
    this.head = new THREE.Group();
    this.head.position.y = 0.97;
    this.body.add(this.head);
    const headM = S(new THREE.Mesh(new THREE.SphereGeometry(0.22, 28, 20), skin));
    headM.scale.set(1, 0.95, 0.95);
    this.head.add(headM);
    // 머리카락
    const hairM = S(new THREE.Mesh(new THREE.SphereGeometry(0.235, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.55), hair));
    hairM.rotation.x = -0.35;
    hairM.position.set(0, 0.015, -0.015);
    this.head.add(hairM);
    const bangs = S(new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), hair));
    bangs.scale.set(1.6, 0.55, 0.8);
    bangs.position.set(0.03, 0.13, 0.15);
    bangs.rotation.z = -0.2;
    this.head.add(bangs);
    // 눈 · 볼
    const eyeM = std('#2b211d', 0.3);
    this.eyes = [];
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), eyeM);
      e.scale.set(1, 1.25, 0.6);
      e.position.set(s * 0.075, 0.0, 0.2);
      this.head.add(e);
      this.eyes.push(e);
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.03, 14), new THREE.MeshBasicMaterial({ color: '#f2a19a', transparent: true, opacity: 0.55 }));
      blush.position.set(s * 0.12, -0.055, 0.185);
      blush.rotation.y = s * 0.55;
      this.head.add(blush);
    }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 6, 10, Math.PI), eyeM);
    mouth.rotation.z = Math.PI;
    mouth.position.set(0, -0.06, 0.205);
    this.head.add(mouth);

    this.setName(name);
    this.t = Math.random() * 5;
    this.phase = 0;
    this.sitting = 0;
    this.seatFloor = false;
    this.waveT = 0;
    this.blinkT = 2;
  }

  setName(name) {
    if (this.label) { this.root.remove(this.label); this.label.material.map.dispose(); }
    this.label = textSprite(name, { height: 0.026, screen: true });
    this.label.position.y = 1.42;
    this.root.add(this.label);
  }

  wave() { this.waveT = 2.2; }

  update(dt, speed, sitTarget) {
    this.t += dt;
    const walking = speed > 0.05;
    this.phase += dt * speed * 7.5;
    const sw = walking ? Math.sin(this.phase) : 0;
    this.sitting = lerp(this.sitting, sitTarget ? 1 : 0, 1 - Math.exp(-8 * dt));
    const s = this.sitting;

    this.legs.forEach((l, i) => {
      l.rotation.x = (i ? -sw : sw) * 0.6 * (1 - s) - s * 1.45;
    });
    this.arms.forEach((a, i) => {
      a.rotation.x = (i ? sw : -sw) * 0.5 * (1 - s) - s * 0.4;
    });
    if (this.waveT > 0) {
      this.waveT -= dt;
      const a = this.arms[1];
      a.rotation.x = -0.2;
      a.rotation.z = 2.6 + Math.sin(this.t * 12) * 0.35;
    } else {
      this.arms[1].rotation.z = lerp(this.arms[1].rotation.z, 0.12, 1 - Math.exp(-10 * dt));
    }
    // 앉으면 엉덩이 높이(0.38)를 자리 높이에 맞춤 → 바깥에서 root.y 조절
    this.body.position.y = Math.abs(sw) * 0.03 + Math.sin(this.t * 2) * 0.004 * (1 - (walking ? 1 : 0));
    this.body.rotation.z = sw * 0.04;
    this.head.rotation.y = Math.sin(this.t * 0.5) * 0.12 * (walking ? 0 : 1);
    // 깜빡
    this.blinkT -= dt;
    if (this.blinkT < 0) this.blinkT = 2.5 + Math.random() * 3;
    const closed = this.blinkT < 0.12;
    this.eyes.forEach((e) => (e.scale.y = closed ? 0.15 : 1.25));
  }
}
