import { Plane, Raycaster, Vector2, Vector3 } from "three";
import { moveWithCollision, nudgeToFree } from "../physics/collision.js";
import { showMessage } from "../ui/toast.js";

/** Installs floor dragging, click/key drop, and R rotation controls; distances use scene units. */
export function installDrag({ renderer, camera, orbit, furniture, room }) {
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const floorPlane = new Plane(new Vector3(0, 1, 0), 0);
  const hitPoint = new Vector3();
  const dragOffset = new Vector3();
  let dragging = false;
  let activeItem = null;

  function setPointer(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
  }
  function pick() {
    const hits = raycaster.intersectObjects(furniture, true);
    if (hits.length === 0) return null;
    let object = hits[0].object;
    while (object && !object.userData.isFurniture) object = object.parent;
    return object;
  }
  function startDrag(item, event) {
    setPointer(event);
    if (!raycaster.ray.intersectPlane(floorPlane, hitPoint)) return;
    activeItem = item;
    dragging = true;
    orbit.enabled = false;
    renderer.domElement.style.cursor = "grabbing";
    dragOffset.copy(hitPoint).sub(item.position);
    showMessage("Click to drop it here. Press R to rotate.");
  }
  function stopDrag() {
    if (!dragging) return;
    dragging = false;
    activeItem = null;
    orbit.enabled = true;
    renderer.domElement.style.cursor = "auto";
  }

  renderer.domElement.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    setPointer(event);
    if (raycaster.ray.intersectPlane(floorPlane, hitPoint)) {
      moveWithCollision(
        activeItem,
        hitPoint.x - dragOffset.x,
        hitPoint.z - dragOffset.z,
        room,
        furniture,
      );
    }
  });
  window.addEventListener("pointerdown", stopDrag);
  window.addEventListener("keydown", (event) => {
    if (!dragging) return;
    if (event.key.toLowerCase() === "r" && !event.ctrlKey && !event.metaKey) {
      if (event.repeat) return;
      const oldRot = activeItem.rotation.y;
      const oldX = activeItem.position.x;
      const oldZ = activeItem.position.z;
      activeItem.rotation.y += Math.PI / 2;
      if (!nudgeToFree(activeItem, 1.5, room, furniture)) {
        activeItem.rotation.y = oldRot;
        activeItem.position.set(oldX, 0, oldZ);
        showMessage("No space to rotate here");
      }
      return;
    }
    stopDrag();
  });

  return { startDrag, stopDrag, isDragging: () => dragging, pick, setPointer };
}
