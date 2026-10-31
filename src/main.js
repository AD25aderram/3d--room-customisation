import {
  AmbientLight,
  AxesHelper,
  Box3,
  BoxGeometry,
  CameraHelper,
  Color,
  DirectionalLight,
  DirectionalLightHelper,
  GridHelper,
  Group,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Plane,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { buildCustomRoom } from "./custom_model.js";

// ---------- Settings ----------
// ---------- Furniture catalog ----------
// To add a new object later, push one more entry to this array.
//   id        unique key
//   label     name shown in the Add menu
//   path      .glb file
//   width     target width in scene units (used when no height is given)
//   height    optional: target height instead of width (good for tall, thin objects like lamps)
//   rotationY optional: turns the model so its front faces +Z
const CATALOG = [
  { id: "sofa",    label: "Sofa",    path: "../models/black_sofa.glb", width: 3.5 },
  { id: "table",   label: "Table",   path: "../models/table.glb",      width: 2.5 },
  { id: "bed",     label: "Bed",     path: "../models/bed.glb",        width: 3 },
  { id: "lamp",    label: "Lamp",    path: "../models/lamp.glb",       height: 2.2 },
  { id: "desktop", label: "Desktop", path: "../models/desktop.glb",    width: 2 },
];
const HOLD_MS = 1000;            // hold on the sofa this long to start dragging
const MOVE_TOLERANCE = 8;        // px of movement that cancels the hold
const SHOW_HELPERS = true;       // axes, grid, light and shadow helpers

// ---------- Core setup ----------
const container = document.getElementById("scene-container");

const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
container.append(renderer.domElement);

const scene = new Scene();
scene.background = new Color("skyblue");

const camera = new PerspectiveCamera(
  35,
  container.clientWidth / container.clientHeight,
  0.1,
  100
);
camera.position.set(14, 10, 18);

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(0, 1.5, 0);
orbit.enableDamping = true;
orbit.update();

// ---------- Lights ----------
scene.add(new AmbientLight(0xffffff, 0.4));

const directionalLight = new DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(4, 8, 3);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.set(2048, 2048);
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 25;
directionalLight.shadow.camera.left = -8;
directionalLight.shadow.camera.right = 8;
directionalLight.shadow.camera.top = 8;
directionalLight.shadow.camera.bottom = -8;
scene.add(directionalLight);

// ---------- Helpers ----------
if (SHOW_HELPERS) {
  scene.add(new AxesHelper(10));

  const gridHelper = new GridHelper(10, 10);
  gridHelper.position.y = 0.01; // avoid z-fighting with the floor top
  scene.add(gridHelper);

  scene.add(new DirectionalLightHelper(directionalLight, 1));
  scene.add(new CameraHelper(directionalLight.shadow.camera));
}

// ---------- Room ----------
let W = 10, D = 10, H = 4, T = 0.2;

const floorMat = new MeshStandardMaterial({ color: 0x8b5a2b }); // wood brown
const backMat  = new MeshStandardMaterial({ color: 0xd9e4f5 }); // light blue
const frontMat = new MeshStandardMaterial({ color: 0xf2d4d4 }); // soft pink
const leftMat  = new MeshStandardMaterial({ color: 0xf5e6d3 }); // warm beige
const rightMat = new MeshStandardMaterial({ color: 0xd4f2d9 }); // mint green

const room = new Group();
const walls = []; // { mesh, normal } where normal points OUTWARD from the room

function addPart(w, h, d, x, y, z, material) {
  const mesh = new Mesh(new BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  room.add(mesh);
  return mesh;
}

function addWall(w, h, d, x, y, z, normal, material) {
  const mesh = addPart(w, h, d, x, y, z, material);
  walls.push({ mesh, normal: new Vector3(...normal) });
}

const savedRoom = sessionStorage.getItem("customRoom");
let customRoom = null;
if (savedRoom) {
  try {
    const { points, pillars } = JSON.parse(savedRoom);
    if (Array.isArray(points) && points.length >= 3 && Array.isArray(pillars)) {
      customRoom = buildCustomRoom(points, pillars);
      const bounds = new Box3().setFromObject(customRoom);
      W = bounds.max.x - bounds.min.x;
      D = bounds.max.z - bounds.min.z;
      H = bounds.max.y - bounds.min.y;
      T = 0.2;
      room.add(customRoom);
      walls.push(...customRoom.userData.walls);
      sessionStorage.removeItem("customRoom");
    }
  } catch (error) {
    console.error("Could not load the custom room:", error);
    sessionStorage.removeItem("customRoom");
  }
}

if (!customRoom) {
  addPart(W, T, D, 0, -T / 2, 0, floorMat); // floor, top surface at y = 0

  addWall(W, H, T, 0, H / 2, -D / 2, [0, 0, -1], backMat);      // back
  addWall(W, H, T, 0, H / 2,  D / 2, [0, 0,  1], frontMat);     // front
  addWall(T, H, D - T, -W / 2, H / 2, 0, [-1, 0, 0], leftMat);  // left
  addWall(T, H, D - T,  W / 2, H / 2, 0, [ 1, 0, 0], rightMat); // right
}

scene.add(room);

// Hide walls that sit between the camera and the room
const _wallPos = new Vector3();
const _normal = new Vector3();
const _toCam = new Vector3();

function updateWallVisibility() {
  room.updateMatrixWorld();
  for (const { mesh, normal } of walls) {
    mesh.getWorldPosition(_wallPos);
    _normal.copy(normal).transformDirection(mesh.parent.matrixWorld);
    _toCam.copy(camera.position).sub(_wallPos);
    mesh.visible = _toCam.dot(_normal) <= 0;
  }
}

// ---------- Furniture ----------
const furniture = []; // every placed object (each one is a pivot Group)

// Inner faces of the walls
const limitX = W / 2 - T / 2;
const limitZ = D / 2 - T / 2;

const GRID_STEP = 0.25; // resolution when searching for a free spot
const EPS = 1e-4;

// Keeps the object inside the walls and on the floor
const _box = new Box3();
function clampToRoom(obj) {
  obj.updateMatrixWorld(true);
  _box.setFromObject(obj);

  const halfX = (_box.max.x - _box.min.x) / 2;
  const halfZ = (_box.max.z - _box.min.z) / 2;
  const cx = (_box.max.x + _box.min.x) / 2 - obj.position.x;
  const cz = (_box.max.z + _box.min.z) / 2 - obj.position.z;

  const minX = -limitX + halfX - cx, maxX = limitX - halfX - cx;
  const minZ = -limitZ + halfZ - cz, maxZ = limitZ - halfZ - cz;

  obj.position.x = Math.min(Math.max(obj.position.x, minX), maxX);
  obj.position.z = Math.min(Math.max(obj.position.z, minZ), maxZ);
  obj.position.y = 0;
}

// ----- Overlap helpers (footprints on the floor) -----
function footprint(obj) {
  obj.updateMatrixWorld(true);
  const b = new Box3().setFromObject(obj);
  return { minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z };
}

function rectsOverlap(a, b) {
  return (
    a.minX < b.maxX - EPS && a.maxX > b.minX + EPS &&
    a.minZ < b.maxZ - EPS && a.maxZ > b.minZ + EPS
  );
}

function overlapsOthers(item) {
  const rect = footprint(item);
  return furniture.some((o) => o !== item && rectsOverlap(rect, footprint(o)));
}

// Scans the floor for the free spot closest to the room center.
// Tries the object as is, then turned 90 degrees.
function findFreeSpot(pivot) {
  const others = furniture.map(footprint);
  let best = null;

  for (const rot of [0, Math.PI / 2]) {
    pivot.rotation.y = rot;
    pivot.position.set(0, 0, 0);
    const f = footprint(pivot); // footprint when the pivot sits at the origin

    const minPX = -limitX - f.minX, maxPX = limitX - f.maxX;
    const minPZ = -limitZ - f.minZ, maxPZ = limitZ - f.maxZ;

    for (let x = minPX; x <= maxPX + EPS; x += GRID_STEP) {
      for (let z = minPZ; z <= maxPZ + EPS; z += GRID_STEP) {
        const rect = {
          minX: f.minX + x, maxX: f.maxX + x,
          minZ: f.minZ + z, maxZ: f.maxZ + z,
        };
        if (others.some((o) => rectsOverlap(rect, o))) continue;

        const dist = Math.hypot(x, z);
        if (!best || dist < best.dist) best = { x, z, rot, dist };
      }
    }
  }
  return best;
}

// ----- Moving with collision -----
// Tries one small move; undoes it if it would overlap another object.
function tryOffset(item, ox, oz) {
  const oldX = item.position.x, oldZ = item.position.z;
  item.position.set(oldX + ox, 0, oldZ + oz);
  clampToRoom(item);
  if (!overlapsOthers(item)) return true;
  item.position.set(oldX, 0, oldZ);
  return false;
}

// Moves toward the target in small steps so it can't jump through another
// object. If blocked, it slides along the obstacle (x only, then z only).
function moveWithCollision(item, targetX, targetZ) {
  const dx = targetX - item.position.x;
  const dz = targetZ - item.position.z;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.2));
  const sx = dx / steps, sz = dz / steps;

  for (let i = 0; i < steps; i++) {
    if (!tryOffset(item, sx, sz) && !tryOffset(item, sx, 0)) {
      tryOffset(item, 0, sz);
    }
  }
}

// ----- Loading -----
const loader = new GLTFLoader();
const modelCache = new Map(); // path -> Promise of the loaded scene

function loadModel(path) {
  if (!modelCache.has(path)) {
    modelCache.set(
      path,
      loader.loadAsync(path).then((gltf) => gltf.scene).catch((error) => {
        modelCache.delete(path); // allow a retry later
        throw error;
      })
    );
  }
  return modelCache.get(path);
}

// Builds a pivot Group: scaled, centered, bottom at y = 0
async function buildFurniture(entry) {
  const source = await loadModel(path_of(entry));
  const model = source.clone(true);

  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  model.rotation.y = entry.rotationY ?? 0;

  let box = new Box3().setFromObject(model);
  const size = box.getSize(new Vector3());
  const scale = entry.height ? entry.height / size.y : entry.width / size.x;
  model.scale.setScalar(scale);

  box = new Box3().setFromObject(model);
  const center = box.getCenter(new Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;

  const pivot = new Group();
  pivot.add(model);
  pivot.userData.isFurniture = true;
  pivot.userData.entry = entry;
  return pivot;
}

function path_of(entry) {
  return entry.path;
}

async function addFurniture(entry) {
  try {
    const pivot = await buildFurniture(entry);
    const spot = findFreeSpot(pivot);

    if (!spot) {
      showMessage(`Not enough space for ${entry.label}`);
      return;
    }

    pivot.rotation.y = spot.rot;
    pivot.position.set(spot.x, 0, spot.z);
    scene.add(pivot);
    furniture.push(pivot);
  } catch (error) {
    console.error(`Failed to load ${entry.label}:`, error);
    showMessage(`Could not load ${entry.label}`);
  }
}
// ---------- Hold-to-drag ----------
const raycaster = new Raycaster();
const pointer = new Vector2();
const floorPlane = new Plane(new Vector3(0, 1, 0), 0); // the plane y = 0
const hitPoint = new Vector3();
const dragOffset = new Vector3();

let dragging = false;
let activeItem = null;  // the object being dragged
let pendingItem = null; // the object under the pointer while the hold timer runs
let holdTimer = null;
let downX = 0;
let downY = 0;

function setPointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
}

// Returns the furniture pivot under the pointer (nearest one), or null
function pickFurniture() {
  const hits = raycaster.intersectObjects(furniture, true);
  if (hits.length === 0) return null;
  let obj = hits[0].object;
  while (obj && !obj.userData.isFurniture) obj = obj.parent;
  return obj;
}

function cancelHold() {
  clearTimeout(holdTimer);
  holdTimer = null;
  pendingItem = null;
}

function startDrag() {
  holdTimer = null;
  if (!pendingItem) return;
  if (!raycaster.ray.intersectPlane(floorPlane, hitPoint)) return;

  activeItem = pendingItem;
  pendingItem = null;
  dragging = true;
  orbit.enabled = false; // camera stops orbiting while an object is held
  renderer.domElement.style.cursor = "grabbing";
  dragOffset.copy(hitPoint).sub(activeItem.position); // no jump on grab
}

function endDrag() {
  cancelHold();
  if (dragging) {
    dragging = false;
    activeItem = null;
    renderer.domElement.style.cursor = "grab";
  }
  orbit.enabled = true;
}

renderer.domElement.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  setPointer(event);

  const item = pickFurniture();
  if (item) {
    pendingItem = item;
    downX = event.clientX;
    downY = event.clientY;
    holdTimer = setTimeout(startDrag, HOLD_MS);
  }
});

renderer.domElement.addEventListener("pointermove", (event) => {
  setPointer(event);

  if (holdTimer && Math.hypot(event.clientX - downX, event.clientY - downY) > MOVE_TOLERANCE) {
    cancelHold();
  }

  if (dragging) {
    if (raycaster.ray.intersectPlane(floorPlane, hitPoint)) {
      moveWithCollision(
        activeItem,
        hitPoint.x - dragOffset.x,
        hitPoint.z - dragOffset.z
      );
    }
  } else if (!holdTimer) {
    renderer.domElement.style.cursor = pickFurniture() ? "grab" : "auto";
  }
});

renderer.domElement.addEventListener("pointerup", endDrag);
renderer.domElement.addEventListener("pointercancel", endDrag);

// Rotate the held object 90 degrees with R, only while dragging
window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() !== "r" || event.repeat) return;
  if (!dragging || !activeItem) return;

  const oldRot = activeItem.rotation.y;
  const oldX = activeItem.position.x;
  const oldZ = activeItem.position.z;

  activeItem.rotation.y += Math.PI / 2;
  clampToRoom(activeItem);

  if (overlapsOthers(activeItem)) {
    // no room to turn here: undo
    activeItem.rotation.y = oldRot;
    activeItem.position.set(oldX, 0, oldZ);
    showMessage("No room to rotate here");
  }
});


// ---------- Add menu (top left) ----------
let toastTimer = null;
function showMessage(text) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    document.body.append(toast);
  }
  toast.textContent = text;
  toast.style.opacity = "1";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.style.opacity = "0"), 2500);
}

function buildAddMenu() {
  const style = document.createElement("style");
  style.textContent = `
    .add-menu { position: fixed; top: 12px; left: 12px; z-index: 10; font-family: system-ui, sans-serif; }
    .add-menu > button { padding: 8px 14px; border: 0; border-radius: 6px; background: #fff; color: #222; font-size: 14px; cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,.3); }
    .add-list { margin-top: 6px; width: 160px; max-height: 160px; overflow-y: auto; background: #fff; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,.3); }
    .add-list[hidden] { display: none; }
    .add-list button { display: block; width: 100%; padding: 8px 14px; border: 0; background: none; color: #222; text-align: left; font-size: 14px; cursor: pointer; }
    .add-list button:hover { background: #eef3fb; }
    #toast { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); padding: 8px 14px; border-radius: 6px; background: rgba(0,0,0,.8); color: #fff; font: 14px system-ui, sans-serif; z-index: 10; opacity: 0; transition: opacity .2s; pointer-events: none; }
  `;
  document.head.append(style);

  const wrap = document.createElement("div");
  wrap.className = "add-menu";

  const button = document.createElement("button");
  button.textContent = "Add ▾";

  const list = document.createElement("div");
  list.className = "add-list";
  list.hidden = true;

  for (const entry of CATALOG) {
    const option = document.createElement("button");
    option.textContent = entry.label;
    option.addEventListener("click", () => {
      list.hidden = true;
      addFurniture(entry);
    });
    list.append(option);
  }

  button.addEventListener("click", () => (list.hidden = !list.hidden));
  document.addEventListener("pointerdown", (event) => {
    if (!wrap.contains(event.target)) list.hidden = true; // close when clicking elsewhere
  });

  wrap.append(button, list);
  document.body.append(wrap);
}
buildAddMenu();
// ---------- Animation ----------
function animate() {
  requestAnimationFrame(animate);
  updateWallVisibility();
  orbit.update();
  renderer.render(scene, camera);
}
animate();

// ---------- Resize ----------
window.addEventListener("resize", () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});