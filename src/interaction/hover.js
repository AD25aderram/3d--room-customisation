import { Mesh, MeshBasicMaterial, PlaneGeometry } from "three";
import { footprint } from "../physics/collision.js";

/** Tints the floor under the furniture piece the pointer is over, so pieces read as interactive. */
export function installHover({ renderer, scene, drag }) {
  const marker = new Mesh(
    new PlaneGeometry(1, 1),
    new MeshBasicMaterial({ color: 0xc28a2c, transparent: true, opacity: 0.55, depthWrite: false }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.renderOrder = 2;
  marker.visible = false;
  scene.add(marker);

  function show(item) {
    if (!item) {
      marker.visible = false;
      return;
    }
    const rect = footprint(item);
    // 0.2 m larger than the footprint so the tint shows around the piece, not just under it.
    marker.scale.set(rect.maxX - rect.minX + 0.2, rect.maxZ - rect.minZ + 0.2, 1);
    marker.position.set((rect.minX + rect.maxX) / 2, 0.02, (rect.minZ + rect.maxZ) / 2);
    marker.visible = true;
  }

  let queued = false;
  renderer.domElement.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch" || queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      if (drag.isDragging()) return show(null);
      drag.setPointer(event);
      const item = drag.pick();
      renderer.domElement.style.cursor = item ? "pointer" : "";
      show(item);
    });
  });
  renderer.domElement.addEventListener("pointerleave", () => show(null));
}
