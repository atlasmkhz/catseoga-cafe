// 아주 단순한 바닥 이동 도우미: 장애물(상자 영역) 밖으로 밀어내기
import * as THREE from 'three';
import { ROOM } from './room.js';

export function pushOut(room, p, r) {
  p.x = THREE.MathUtils.clamp(p.x, ROOM.minX + r, ROOM.maxX - r);
  p.z = THREE.MathUtils.clamp(p.z, ROOM.minZ + r, ROOM.maxZ - r);
  for (const o of room.obstacles) {
    const x0 = o.minX - r, x1 = o.maxX + r, z0 = o.minZ - r, z1 = o.maxZ + r;
    if (p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1) {
      const dl = p.x - x0, dr = x1 - p.x, dt = p.z - z0, db = z1 - p.z;
      const m = Math.min(dl, dr, dt, db);
      if (m === dl) p.x = x0; else if (m === dr) p.x = x1; else if (m === dt) p.z = z0; else p.z = z1;
    }
  }
  return p;
}

export function insideObstacle(room, p, r = 0) {
  return room.obstacles.some((o) => p.x > o.minX - r && p.x < o.maxX + r && p.z > o.minZ - r && p.z < o.maxZ + r);
}

export function randomFloorPoint(room, r = 0.2) {
  for (let i = 0; i < 40; i++) {
    const p = new THREE.Vector3(
      THREE.MathUtils.lerp(ROOM.minX + 0.6, ROOM.maxX - 0.6, Math.random()), 0,
      THREE.MathUtils.lerp(ROOM.minZ + 0.6, ROOM.maxZ - 0.6, Math.random()));
    if (!insideObstacle(room, p, r + 0.1)) return p;
  }
  return new THREE.Vector3(0, 0, 1);
}
