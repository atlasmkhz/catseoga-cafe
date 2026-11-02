// 아주 단순한 바닥 이동 도우미
// - 장애물(상자 영역) 밖으로 밀어내기
// - 실내 ↔ 정원은 동쪽 문을 거쳐 가도록 길 나누기
import * as THREE from 'three';
import { ROOM, WORLD, DOOR } from './room.js';

export function pushOut(room, p, r) {
  p.x = THREE.MathUtils.clamp(p.x, WORLD.minX + r, WORLD.maxX - r);
  p.z = THREE.MathUtils.clamp(p.z, WORLD.minZ + r, WORLD.maxZ - r);
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

export const isOutdoor = (p) => p.x > ROOM.maxX + 0.1;

// from → to 사이에 문을 지나야 하면 문 안 · 밖 지점을 끼워 넣음
export function route(from, to) {
  const a = isOutdoor(from), b = isOutdoor(to);
  if (a === b) return [to.clone()];
  return a ? [DOOR.outside.clone(), DOOR.inside.clone(), to.clone()] : [DOOR.inside.clone(), DOOR.outside.clone(), to.clone()];
}

// where: 'in' | 'out' | undefined(아무 곳)
export function randomFloorPoint(room, r = 0.2, where) {
  const out = where === 'out' || (!where && Math.random() < 0.3);
  const x0 = out ? ROOM.maxX + 0.8 : ROOM.minX + 0.6, x1 = out ? WORLD.maxX - 0.6 : ROOM.maxX - 0.6;
  for (let i = 0; i < 50; i++) {
    const p = new THREE.Vector3(THREE.MathUtils.lerp(x0, x1, Math.random()), 0, THREE.MathUtils.lerp(WORLD.minZ + 0.6, WORLD.maxZ - 0.6, Math.random()));
    if (!insideObstacle(room, p, r + 0.1)) return p;
  }
  return out ? DOOR.outside.clone() : DOOR.inside.clone();
}
