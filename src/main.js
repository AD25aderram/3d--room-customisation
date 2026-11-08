import { loadRoom } from "./room/loadRoom.js";
import { createScene } from "./core/scene.js";
import { CATALOG } from "./furniture/catalog.js";
import { buildFurniture, buildFurnitureFromFile } from "./furniture/loader.js";
import { findFreeSpot } from "./furniture/placement.js";
import { createFurnitureStore } from "./furniture/store.js";
import { updateWallVisibility } from "./room/wallVisibility.js";
import { installDrag } from "./interaction/drag.js";
import { installHover } from "./interaction/hover.js";
import { installContextMenu } from "./interaction/contextMenu.js";
import { buildAddMenu } from "./ui/addMenu.js";
import { showMessage } from "./ui/toast.js";

const container = document.getElementById("scene-container");
const room = loadRoom();
const {
  renderer,
  scene,
  camera,
  orbit,
  bounds,
  centerX,
  centerZ,
} = createScene(container, room);
const collisionRoom = {
  outline: room.userData.outline,
  pillars: room.userData.pillars ?? [],
  wallThickness: room.userData.wallThickness ?? 0.12,
  bounds,
  centerX,
  centerZ,
};

// Floor area in m² (scene units are metres), minus pillars, plus a live piece count.
const polygonArea = (polygon) =>
  Math.abs(polygon.reduce((sum, p, i) => {
    const q = polygon[(i + 1) % polygon.length];
    return sum + p.x * q.z - q.x * p.z;
  }, 0)) / 2;
const floorArea =
  polygonArea(collisionRoom.outline) -
  collisionRoom.pillars.reduce((sum, pillar) => sum + polygonArea(pillar), 0);
const meta = document.getElementById("room-meta");
function updateMeta(items = []) {
  if (!meta) return;
  const count = items.length;
  meta.textContent = `${floorArea.toFixed(1)} m² · ${count} ${count === 1 ? "piece" : "pieces"}`;
}
updateMeta();

const store = createFurnitureStore(updateMeta);
const furniture = store.items;

function placeFurniture(pivot, entry) {
  const spot = findFreeSpot(pivot, collisionRoom, furniture);
  if (!spot) {
    showMessage(`No free floor left for the ${entry.label.toLowerCase()}`);
    return;
  }
  pivot.rotation.y = spot.rot;
  pivot.position.set(spot.x, 0, spot.z);
  scene.add(pivot);
  store.add(pivot);
}

async function addFurniture(entry) {
  try {
    const pivot = entry.file
      ? await buildFurnitureFromFile(entry.file, entry)
      : await buildFurniture(entry);
    placeFurniture(pivot, entry);
  } catch (error) {
    console.error(`Failed to load ${entry.label}:`, error);
    showMessage(`Could not load ${entry.label}`);
  }
}

async function importFurniture(file, addEntry) {
  if (!file.name.toLowerCase().endsWith(".glb")) {
    showMessage("Choose a .glb file");
    return;
  }
  if (file.size === 0) {
    showMessage("The selected file is empty");
    return;
  }

  const label = file.name.replace(/\.glb$/i, "") || file.name;
  const entry = {
    id: `imported-${Date.now()}-${file.name}`,
    label,
    file,
    width: 2,
  };
  try {
    const pivot = await buildFurnitureFromFile(file, entry);
    addEntry(entry);
    placeFurniture(pivot, entry);
  } catch (error) {
    console.error(`Failed to load ${file.name}:`, error);
    showMessage(`Could not load ${file.name}`);
  }
}

buildAddMenu(CATALOG, addFurniture, importFurniture);
const drag = installDrag({ renderer, camera, orbit, scene, furniture, room: collisionRoom });
installHover({ renderer, scene, drag });
installContextMenu({ renderer, furniture, scene, drag, store, room: collisionRoom });

// "Reset view" returns the camera to where it started.
const home = { position: camera.position.clone(), target: orbit.target.clone() };
document.getElementById("reset-view")?.addEventListener("click", () => {
  camera.position.copy(home.position);
  orbit.target.copy(home.target);
  orbit.update();
});

// The hint goes away once the person finds the menu, or after a while.
const hint = document.getElementById("hint");
const dismissHint = () => hint?.classList.add("is-done");
renderer.domElement.addEventListener("contextmenu", dismissHint, { once: true });
renderer.domElement.addEventListener("dblclick", dismissHint, { once: true });
setTimeout(dismissHint, 20000);

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
