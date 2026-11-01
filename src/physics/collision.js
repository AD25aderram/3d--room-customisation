import { Box3 } from "three";
import { EPS } from "../config.js";
import {
  pointInPolygon,
  polygonHitsRect,
  rectsOverlap,
  segmentHitsRect,
} from "./geometry.js";

/** Builds an object's world-space floor footprint, caching bounds for its current rotation. */
export function footprint(obj) {
  let cached = obj.userData.fp;
  if (!cached || cached.rot !== obj.rotation.y) {
    obj.updateMatrixWorld(true);
    const box = new Box3().setFromObject(obj);
    cached = obj.userData.fp = {
      rot: obj.rotation.y,
      minX: box.min.x - obj.position.x,
      maxX: box.max.x - obj.position.x,
      minZ: box.min.z - obj.position.z,
      maxZ: box.max.z - obj.position.z,
    };
  }
  return {
    minX: cached.minX + obj.position.x,
    maxX: cached.maxX + obj.position.x,
    minZ: cached.minZ + obj.position.z,
    maxZ: cached.maxZ + obj.position.z,
  };
}

/** Tests whether floor rectangle r fits within room outline and outside pillars. */
export function fitsInRoom(r, room) {
  const margin = room.wallThickness / 2;
  const grown = {
    minX: r.minX - margin,
    maxX: r.maxX + margin,
    minZ: r.minZ - margin,
    maxZ: r.maxZ + margin,
  };

  for (let i = 0; i < room.outline.length; i++) {
    if (segmentHitsRect(room.outline[i], room.outline[(i + 1) % room.outline.length], grown)) {
      return false;
    }
  }
  if (!pointInPolygon((r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2, room.outline)) {
    return false;
  }
  return !room.pillars.some((pillar) => polygonHitsRect(pillar, r));
}

/** Tests whether item has a free footprint in room and among the furniture list. */
export function isFree(item, room, furniture) {
  const rect = footprint(item);
  if (!fitsInRoom(rect, room)) return false;
  return !furniture.some(
    (other) => other !== item && rectsOverlap(rect, footprint(other), EPS),
  );
}

/** Moves item to the nearest free spot within radius floor units after rotation. */
export function nudgeToFree(item, radius, room, furniture) {
  const x0 = item.position.x;
  const z0 = item.position.z;
  let best = null;

  for (let dx = -radius; dx <= radius + EPS; dx += 0.1) {
    for (let dz = -radius; dz <= radius + EPS; dz += 0.1) {
      const distance = Math.hypot(dx, dz);
      if (best && distance >= best.distance) continue;
      item.position.set(x0 + dx, 0, z0 + dz);
      if (isFree(item, room, furniture)) {
        best = { x: x0 + dx, z: z0 + dz, distance };
      }
    }
  }

  if (!best) {
    item.position.set(x0, 0, z0);
    return false;
  }
  item.position.set(best.x, 0, best.z);
  return true;
}

/** Attempts floor offset (ox, oz), restoring the original position if blocked. */
export function tryOffset(item, ox, oz, room, furniture) {
  const x0 = item.position.x;
  const z0 = item.position.z;
  let fraction = 1;
  for (let i = 0; i < 6; i++) {
    item.position.set(x0 + ox * fraction, 0, z0 + oz * fraction);
    if (isFree(item, room, furniture)) return true;
    fraction /= 2;
  }
  item.position.set(x0, 0, z0);
  return false;
}

/** Moves item toward target floor coordinates while sliding along blocked obstacles. */
export function moveWithCollision(item, targetX, targetZ, room, furniture) {
  const dx = targetX - item.position.x;
  const dz = targetZ - item.position.z;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.2));
  const stepX = dx / steps;
  const stepZ = dz / steps;

  for (let i = 0; i < steps; i++) {
    if (!tryOffset(item, stepX, stepZ, room, furniture) &&
        !tryOffset(item, stepX, 0, room, furniture)) {
      tryOffset(item, 0, stepZ, room, furniture);
    }
  }
}
