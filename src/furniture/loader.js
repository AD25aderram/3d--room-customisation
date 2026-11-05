import { Box3, Group, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const loader = new GLTFLoader();
const modelCache = new Map();
const importedModelCache = new WeakMap();

/** Loads a model path, sharing in-flight and completed loads by path. */
export function loadModel(path) {
  if (!modelCache.has(path)) {
    modelCache.set(
      path,
      loader.loadAsync(path).then((gltf) => gltf.scene).catch((error) => {
        modelCache.delete(path);
        throw error;
      }),
    );
  }
  return modelCache.get(path);
}

/** Builds a centered furniture pivot using catalog sizing metadata in scene units. */
export async function buildFurniture(entry) {
  const source = await loadModel(entry.path);
  return buildFurniturePivot(source, entry);
}

/** Parses a GLB File and builds its furniture pivot using entry dimensions in scene units. */
export async function buildFurnitureFromFile(file, entry = { width: 2 }) {
  if (!file.name.toLowerCase().endsWith(".glb")) {
    throw new Error("Choose a .glb file");
  }
  if (file.size === 0) {
    throw new Error("The selected file is empty");
  }

  if (!importedModelCache.has(file)) {
    importedModelCache.set(
      file,
      file.arrayBuffer()
        .then((data) => loader.parseAsync(data, ""))
        .then((gltf) => gltf.scene)
        .catch((error) => {
          importedModelCache.delete(file);
          throw error;
        }),
    );
  }
  const source = await importedModelCache.get(file);
  return buildFurniturePivot(source, entry);
}

function buildFurniturePivot(source, entry) {
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
  if (entry.file && (box.isEmpty() || !Number.isFinite(size.x) || size.x <= 0)) {
    throw new Error("The GLB file has no usable model geometry");
  }
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
