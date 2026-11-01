import { Vector3 } from "three";

const _wallPos = new Vector3();
const _normal = new Vector3();
const _toCam = new Vector3();

/** Updates room wall visibility according to which side of each wall the camera occupies. */
export function updateWallVisibility(room, camera) {
  room.updateMatrixWorld();
  for (const { mesh, normal } of room.userData.walls ?? []) {
    mesh.getWorldPosition(_wallPos);
    _normal.copy(normal).transformDirection(mesh.parent.matrixWorld);
    _toCam.copy(camera.position).sub(_wallPos);
    mesh.visible = _toCam.dot(_normal) <= 0;
  }
}
