import { loadRoom } from "./room/loadRoom.js";
import { createScene } from "./core/scene.js";
import { CATALOG } from "./furniture/catalog.js";
import { buildFurniture, buildFurnitureFromFile } from "./furniture/loader.js";
import { createFurnitureStore } from "./furniture/store.js";
import { updateWallVisibility } from "./room/wallVisibility.js";
import { installDrag } from "./interaction/drag.js";
import { installHover } from "./interaction/hover.js";
import { installPlacementPreview } from "./interaction/placementPreview.js";
import { installContextMenu } from "./interaction/contextMenu.js";
import { buildAddMenu } from "./ui/addMenu.js";
import { showMessage } from "./ui/toast.js";
import { createBehaviorHistory } from "./undo/behaviorCatalog.js";

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
const undoButton = document.getElementById("undo-action");
const history = createBehaviorHistory({
  scene,
  store,
  onChange: (canUndo, latestLabel) => {
    if (!undoButton) return;
    undoButton.disabled = !canUndo;
    undoButton.title = canUndo ? `Undo ${latestLabel}` : "Nothing to undo";
  },
});
undoButton?.addEventListener("click", () => history.undo());

const placementPreview = installPlacementPreview({
  renderer, camera, orbit, scene, furniture, room: collisionRoom, store, history,
});

async function addFurniture(entry) {
  try {
    const pivot = entry.file
      ? await buildFurnitureFromFile(entry.file, entry)
      : await buildFurniture(entry);
    placementPreview.begin(pivot, entry);
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
    placementPreview.begin(pivot, entry);
  } catch (error) {
    console.error(`Failed to load ${file.name}:`, error);
    showMessage(`Could not load ${file.name}`);
  }
}

buildAddMenu(CATALOG, addFurniture, importFurniture);
const drag = installDrag({ renderer, camera, orbit, furniture, room: collisionRoom, history });
installHover({ renderer, scene, drag, isPlacementActive: placementPreview.isActive });
installContextMenu({ renderer, furniture, scene, drag, store, room: collisionRoom, history });

// "Reset view" returns the camera to where it started.
const home = { position: camera.position.clone(), target: orbit.target.clone() };
document.getElementById("reset-view")?.addEventListener("click", () => {
  camera.position.copy(home.position);
  orbit.target.copy(home.target);
  orbit.update();
});

// Camera presets keep the same room target and only change the camera position.
const viewToggle = document.getElementById("view-menu-toggle");
const viewMenu = document.getElementById("view-menu");
const viewOptions = [...(viewMenu?.querySelectorAll("[data-camera-view]") ?? [])];
const roomWidth = bounds.maxX - bounds.minX;
const roomDepth = bounds.maxZ - bounds.minZ;
const viewDistance = Math.max(roomWidth, roomDepth) * 1.8;
const wallHeight = room.userData.walls?.reduce((height, wall) =>
  Math.max(height, (wall.mesh.position.y ?? 0) + (wall.mesh.geometry.parameters.height ?? 0) / 2), 0
) || 2.5;

function setCameraView(view) {
  const target = orbit.target.clone().set(centerX, view === "eye" ? wallHeight / 2 : 1.5, centerZ);
  orbit.target.copy(target);
  if (view === "top") {
    camera.position.set(centerX, target.y + viewDistance, centerZ);
  } else {
    const height = view === "eye" ? target.y : viewDistance * 0.55;
    const horizontal = Math.sqrt(Math.max(0, viewDistance ** 2 - (height - target.y) ** 2));
    camera.position.set(centerX + horizontal * 0.62, height, centerZ + horizontal * 0.78);
  }
  orbit.update();
  viewOptions.forEach((option) => option.setAttribute("aria-checked", String(option.dataset.cameraView === view)));
}

viewToggle?.addEventListener("click", () => {
  const open = viewToggle.getAttribute("aria-expanded") === "true";
  viewToggle.setAttribute("aria-expanded", String(!open));
  viewMenu.hidden = open;
});
viewOptions.forEach((option) => option.addEventListener("click", () => {
  setCameraView(option.dataset.cameraView);
  viewMenu.hidden = true;
  viewToggle.setAttribute("aria-expanded", "false");
}));
document.addEventListener("pointerdown", (event) => {
  if (!event.target.closest(".view-control")) {
    viewMenu.hidden = true;
    viewToggle?.setAttribute("aria-expanded", "false");
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && viewToggle?.getAttribute("aria-expanded") === "true") {
    viewMenu.hidden = true;
    viewToggle.setAttribute("aria-expanded", "false");
    viewToggle.focus();
  }
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
