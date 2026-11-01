import { GRID_STEP } from "../config.js";
import { footprint, fitsInRoom } from "../physics/collision.js";
import { rectsOverlap } from "../physics/geometry.js";

/** Finds the valid floor position nearest the room bounds center, trying 0 and 90 degree rotations. */
export function findFreeSpot(pivot, room, furniture) {
  const others = furniture.map(footprint);
  let best = null;
  for (const rotation of [0, Math.PI / 2]) {
    pivot.rotation.y = rotation;
    pivot.position.set(0, 0, 0);
    const relativeFootprint = footprint(pivot);
    for (let x = room.bounds.minX; x <= room.bounds.maxX; x += GRID_STEP) {
      for (let z = room.bounds.minZ; z <= room.bounds.maxZ; z += GRID_STEP) {
        const distance = Math.hypot(x - room.centerX, z - room.centerZ);
        if (best && distance >= best.distance) continue;
        const rect = {
          minX: relativeFootprint.minX + x,
          maxX: relativeFootprint.maxX + x,
          minZ: relativeFootprint.minZ + z,
          maxZ: relativeFootprint.maxZ + z,
        };
        if (!fitsInRoom(rect, room)) continue;
        if (others.some((other) => rectsOverlap(rect, other))) continue;
        best = { x, z, rot: rotation, distance };
      }
    }
  }
  return best;
}
