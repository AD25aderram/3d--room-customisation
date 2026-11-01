import {
  AmbientLight, AxesHelper, CameraHelper, Color, DirectionalLight,
  DirectionalLightHelper, GridHelper, PCFSoftShadowMap, PerspectiveCamera,
  Scene, WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SHOW_HELPERS } from "../config.js";

/** Creates the renderer, scene, camera, controls, and lighting for the given room bounds. */
export function createScene(container, room) {
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  container.append(renderer.domElement);

  const scene = new Scene();
  scene.background = new Color("skyblue");
  const camera = new PerspectiveCamera(35, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(14, 10, 18);
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.target.set(0, 1.5, 0);
  orbit.enableDamping = true;
  orbit.update();

  scene.add(new AmbientLight(0xffffff, 0.4));
  const directionalLight = new DirectionalLight(0xffffff, 1.5);
  directionalLight.position.set(4, 8, 3);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.set(2048, 2048);
  Object.assign(directionalLight.shadow.camera, {
    near: 0.5, far: 25, left: -8, right: 8, top: 8, bottom: -8,
  });
  scene.add(directionalLight);

  if (SHOW_HELPERS) {
    scene.add(new AxesHelper(10));
    const gridHelper = new GridHelper(10, 10);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper, new DirectionalLightHelper(directionalLight, 1));
    scene.add(new CameraHelper(directionalLight.shadow.camera));
  }

  scene.add(room);
  const outline = room.userData.outline;
  const bounds = {
    minX: Math.min(...outline.map((p) => p.x)),
    maxX: Math.max(...outline.map((p) => p.x)),
    minZ: Math.min(...outline.map((p) => p.z)),
    maxZ: Math.max(...outline.map((p) => p.z)),
  };
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const extent = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ);
  const scale = Math.max(1, extent / 10);

  camera.position.set(14, 10, 18).multiplyScalar(scale);
  camera.far = 100 * scale;
  camera.updateProjectionMatrix();
  orbit.target.set(centerX, 1.5, centerZ);
  orbit.update();
  directionalLight.position.set(4, 8, 3).multiplyScalar(scale);
  Object.assign(directionalLight.shadow.camera, {
    left: -8 * scale, right: 8 * scale, top: 8 * scale,
    bottom: -8 * scale, far: 25 * scale,
  });
  directionalLight.shadow.camera.updateProjectionMatrix();
  return { renderer, scene, camera, orbit, directionalLight, bounds, centerX, centerZ };
}
