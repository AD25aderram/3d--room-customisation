/** Tests whether floor point (x, z) lies inside polygon vertices using x/z coordinates. */
export function pointInPolygon(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (
      (a.z > z) !== (b.z > z) &&
      x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** Tests whether segment endpoints a/b cross the interior of axis-aligned floor rectangle r. */
export function segmentHitsRect(a, b, r) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const p = [-dx, dx, -dz, dz];
  const q = [a.x - r.minX, r.maxX - a.x, a.z - r.minZ, r.maxZ - a.z];
  let t0 = 0;
  let t1 = 1;

  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] <= 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        t0 = Math.max(t0, t);
      } else {
        if (t < t0) return false;
        t1 = Math.min(t1, t);
      }
    }
  }
  return t1 - t0 > 1e-9;
}

/** Tests whether a floor polygon overlaps the interior of rectangle r. */
export function polygonHitsRect(poly, r) {
  for (let i = 0; i < poly.length; i++) {
    if (segmentHitsRect(poly[i], poly[(i + 1) % poly.length], r)) return true;
  }
  return pointInPolygon((r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2, poly);
}

/** Returns whether axis-aligned floor rectangles a and b overlap beyond EPS. */
export function rectsOverlap(a, b, EPS = 1e-4) {
  return (
    a.minX < b.maxX - EPS &&
    a.maxX > b.minX + EPS &&
    a.minZ < b.maxZ - EPS &&
    a.maxZ > b.minZ + EPS
  );
}
