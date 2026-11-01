import { loadRoom } from "./room/loadRoom.js";
import { createScene } from "./core/scene.js";
import { CATALOG } from "./furniture/catalog.js";
import { buildFurniture } from "./furniture/loader.js";
import { findFreeSpot } from "./furniture/placement.js";
import { createFurnitureStore } from "./furniture/store.js";
import { updateWallVisibility } from "./room/wallVisibility.js";
import { installDrag } from "./interaction/drag.js";
import { installContextMenu } from "./interaction/contextMenu.js";
import { buildAddMenu } from "./ui/addMenu.js";
import { showMessage } from "./ui/toast.js";

const container=document.getElementById("scene-container");
const room=loadRoom();
const {renderer,scene,camera,orbit,bounds,centerX,centerZ}=createScene(container,room);
console.log("room data:",{outline:room.userData.outline,roomPillars:room.userData.pillars??[],roomWallT:room.userData.wallThickness??.12});
const collisionRoom={outline:room.userData.outline,pillars:room.userData.pillars??[],wallThickness:room.userData.wallThickness??.12,bounds,centerX,centerZ};
const store=createFurnitureStore(),furniture=store.items;

async function addFurniture(entry) {
  try {
    const pivot = await buildFurniture(entry);
    const spot = findFreeSpot(pivot, collisionRoom, furniture);
    if (!spot) {
      showMessage(`Not enough space for ${entry.label}`);
      return;
    }
    pivot.rotation.y = spot.rot;
    pivot.position.set(spot.x, 0, spot.z);
    scene.add(pivot);
    store.add(pivot);
  } catch (error) {
    console.error(`Failed to load ${entry.label}:`, error);
    showMessage(`Could not load ${entry.label}`);
  }
}

buildAddMenu(CATALOG,addFurniture);
const drag=installDrag({renderer,camera,orbit,scene,furniture,room:collisionRoom});
installContextMenu({ renderer, furniture, scene, drag, store });

function animate() {
  requestAnimationFrame(animate);
  updateWallVisibility(room, camera);
  orbit.update();
  renderer.render(scene, camera);
}
animate();
window.addEventListener("resize", () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});
