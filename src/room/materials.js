import {
  CanvasTexture, DoubleSide, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace,
} from "three";

/** Size, in scene units (metres), of one repeat of the floor texture. */
const FLOOR_TILE = 2.4;

function seeded(seed) {
  let state = seed;
  return () => (state = (state * 16807) % 2147483647) / 2147483647;
}

/** Draws oak planks to a canvas so the floor needs no image asset. */
function makeFloorTexture() {
  const size = 1024;
  const rows = 8;
  const rowHeight = size / rows;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  const rnd = seeded(42);

  for (let row = 0; row < rows; row++) {
    let x = -rnd() * size * 0.5;
    while (x < size) {
      const length = size * (0.45 + rnd() * 0.4);
      g.fillStyle = `hsl(29, ${30 + rnd() * 8}%, ${46 + rnd() * 8}%)`;
      g.fillRect(x, row * rowHeight, length, rowHeight);
      g.strokeStyle = "rgba(90, 55, 25, 0.12)";
      for (let i = 0; i < 5; i++) {
        const y = row * rowHeight + rnd() * rowHeight;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + length, y + (rnd() - 0.5) * 3);
        g.stroke();
      }
      g.fillStyle = "rgba(50, 30, 15, 0.35)";
      g.fillRect(x, row * rowHeight, 2, rowHeight);
      x += length;
    }
    g.fillStyle = "rgba(50, 30, 15, 0.35)";
    g.fillRect(0, row * rowHeight, size, 2);
  }

  const texture = new CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  texture.repeat.set(1 / FLOOR_TILE, 1 / FLOOR_TILE);
  return texture;
}

/** Oak plank floor. ShapeGeometry UVs are in scene units, so the repeat above maps tiles to metres. */
export function makeFloorMaterial() {
  return new MeshStandardMaterial({
    map: makeFloorTexture(),
    roughness: 0.65,
    metalness: 0,
    side: DoubleSide,
  });
}

/**
 * Wall materials in BoxGeometry face order (+x, -x, +y, -y, +z, -z).
 * The top face is dark so the cut-away walls read like an architectural model.
 */
export function makeWallMaterials() {
  const plaster = new MeshStandardMaterial({ color: 0xefece6, roughness: 0.95 });
  const cap = new MeshStandardMaterial({ color: 0x2a3337, roughness: 0.8 });
  return [plaster, plaster, cap, plaster, plaster, plaster];
}

export function makePillarMaterial() {
  return new MeshStandardMaterial({ color: 0xc28a2c, roughness: 0.6 });
}
