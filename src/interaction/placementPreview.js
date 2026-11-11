import { Mesh, MeshBasicMaterial, PlaneGeometry, Plane, Raycaster, Vector2, Vector3 } from "three";
import { footprint, isFree } from "../physics/collision.js";
import { findFreeSpot } from "../furniture/placement.js";
import { showMessage } from "../ui/toast.js";

/** Previews new furniture as a floor footprint until the user confirms or cancels. */
export function installPlacementPreview({ renderer, camera, orbit, scene, furniture, room, store, history }) {
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const floorPlane = new Plane(new Vector3(0, 1, 0), 0);
  const hitPoint = new Vector3();
  const marker = new Mesh(
    new PlaneGeometry(1, 1),
    new MeshBasicMaterial({ color: 0x20a464, transparent: true, opacity: 0.62, depthWrite: false }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.025;
  marker.renderOrder = 3;
  marker.visible = false;
  scene.add(marker);

  let active = null;
  let savedCamera = null;

  function snapNearWalls(pivot) {
    const snapDistance = 0.35;
    const outline = room.outline;
    const signedArea = outline.reduce((sum, point, index) => {
      const next = outline[(index + 1) % outline.length];
      return sum + point.x * next.z - next.x * point.z;
    }, 0);
    const winding = signedArea >= 0 ? 1 : -1;

    // A second pass lets a placement near a corner snap against both adjoining walls.
    for (let pass = 0; pass < 2; pass += 1) {
      const rect = footprint(pivot);
      const startX = pivot.position.x;
      const startZ = pivot.position.z;
      let best = null;

      for (let index = 0; index < outline.length; index += 1) {
        const a = outline[index];
        const b = outline[(index + 1) % outline.length];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const length = Math.hypot(dx, dz);
        if (!length) continue;
        const tangentX = dx / length;
        const tangentZ = dz / length;
        const inwardX = -tangentZ * winding;
        const inwardZ = tangentX * winding;
        const corners = [
          [rect.minX, rect.minZ], [rect.minX, rect.maxZ],
          [rect.maxX, rect.minZ], [rect.maxX, rect.maxZ],
        ];
        const minInward = Math.min(...corners.map(([x, z]) => x * inwardX + z * inwardZ));
        const targetInward = a.x * inwardX + a.z * inwardZ + (room.wallThickness ?? 0.12) / 2;
        const offset = targetInward - minInward;
        if (Math.abs(offset) < 0.01 || Math.abs(offset) > snapDistance) continue;

        const wallStart = a.x * tangentX + a.z * tangentZ;
        const wallEnd = b.x * tangentX + b.z * tangentZ;
        const wallMin = Math.min(wallStart, wallEnd);
        const wallMax = Math.max(wallStart, wallEnd);
        const rectAlongWall = corners.map(([x, z]) => x * tangentX + z * tangentZ);
        if (Math.min(wallMax, Math.max(...rectAlongWall)) <= Math.max(wallMin, Math.min(...rectAlongWall))) continue;

        pivot.position.set(startX + inwardX * offset, 0, startZ + inwardZ * offset);
        const valid = isFree(pivot, room, furniture);
        pivot.position.set(startX, 0, startZ);
        if (valid && (!best || Math.abs(offset) < Math.abs(best.offset))) {
          best = { x: startX + inwardX * offset, z: startZ + inwardZ * offset, offset };
        }
      }

      if (!best) break;
      pivot.position.set(best.x, 0, best.z);
    }
  }

  function pointFromEvent(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    return raycaster.ray.intersectPlane(floorPlane, hitPoint) ? hitPoint : null;
  }

  function update(event) {
    if (!active) return;
    const point = pointFromEvent(event);
    if (!point) return;
    active.pivot.position.set(point.x, 0, point.z);
    snapNearWalls(active.pivot);
    const valid = isFree(active.pivot, room, furniture);
    marker.position.set(active.pivot.position.x, 0.025, active.pivot.position.z);
    marker.material.color.setHex(valid ? 0x20a464 : 0xd83b3b);
    marker.userData.valid = valid;
  }

  function finish(confirmed) {
    if (!active) return;
    if (confirmed && !marker.userData.valid) {
      showMessage("Can't place furniture here. Move it to a green space.");
      return;
    }

    const { pivot } = active;
    active = null;
    marker.visible = false;
    marker.userData.valid = false;
    orbit.enabled = true;
    renderer.domElement.style.cursor = "";
    if (savedCamera) {
      camera.position.copy(savedCamera.position);
      orbit.target.copy(savedCamera.target);
      orbit.update();
      savedCamera = null;
    }

    if (confirmed) {
      scene.add(pivot);
      const index = furniture.length;
      store.add(pivot);
      history.record("furniture.place", { item: pivot, index });
    }
  }

  function begin(pivot, entry) {
    if (active) return false;
    const spot = findFreeSpot(pivot, room, furniture);
    if (!spot) {
      showMessage(`No free floor left for the ${entry.label.toLowerCase()}`);
      return false;
    }

    pivot.rotation.y = spot.rot;
    pivot.position.set(spot.x, 0, spot.z);
    const bounds = footprint(pivot);
    marker.scale.set(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ, 1);
    marker.position.set(spot.x, 0.025, spot.z);
    marker.material.color.setHex(0x20a464);
    marker.userData.valid = true;
    marker.visible = true;
    active = { pivot, entry };
    savedCamera = { position: camera.position.clone(), target: orbit.target.clone() };
    // Tip a level eye view toward the floor so the pointer can reach every part of the room.
    if (camera.position.y <= orbit.target.y + 0.05) {
      orbit.target.y = 0;
      orbit.update();
    }
    orbit.enabled = false;
    renderer.domElement.style.cursor = "crosshair";
    showMessage("Move the outline. Right-click to place; left-click to cancel.");
    return true;
  }

  renderer.domElement.addEventListener("pointermove", (event) => update(event));
  renderer.domElement.addEventListener("pointerdown", (event) => {
    if (!active) return;
    if (event.button === 0) {
      event.preventDefault();
      event.stopImmediatePropagation();
      finish(false);
    }
  }, true);
  renderer.domElement.addEventListener("contextmenu", (event) => {
    if (!active) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    finish(true);
  }, true);
  window.addEventListener("keydown", (event) => {
    if (active && event.key === "Escape") finish(false);
  });
  window.addEventListener("blur", () => {
    if (active) finish(false);
  });

  return { begin, isActive: () => Boolean(active) };
}
