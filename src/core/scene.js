import {
  ACESFilmicToneMapping, AxesHelper, CameraHelper, DirectionalLight,
  DirectionalLightHelper, GridHelper, HemisphereLight, PCFSoftShadowMap,
  PerspectiveCamera, PMREMGenerator, Scene, WebGLRenderer,
} from "three";


import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { SHOW_HELPERS } from "../config.js";

/** Creates the renderer, scene, camera, controls, and lighting for the given room bounds. */
export function createScene(container, room) {
  // Transparent canvas: the page's CSS gradient is the backdrop.
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  container.append(renderer.domElement);

  const scene = new Scene();
  // Environment mapping
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  const camera = new PerspectiveCamera(35, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(14, 10, 18);
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.target.set(0, 1.5, 0);
  orbit.enableDamping = true;
  orbit.maxPolarAngle = Math.PI / 2 - 0.04; // never orbit under the floor
  orbit.minDistance = 3;
  orbit.update();

  scene.add(new HemisphereLight(0xffffff, 0xd8cfc0, 0.35));
  const directionalLight = new DirectionalLight(0xfff4e5, 1.6);
  directionalLight.position.set(4, 8, 3);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.set(2048, 2048);
  directionalLight.shadow.bias = -0.0004;
  directionalLight.shadow.normalBias = 0.03;
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
  // Camera distance follows room size; small rooms get framed closer instead of floating in the distance.
  const scale = Math.max(0.5, extent / 10);
  // On tall, narrow screens (phones) pull the camera back so the room's width still fits.
  const aspect = container.clientWidth / container.clientHeight;
  const fit = Math.min(2.5, Math.max(1, 1 / aspect));

  camera.position.set(14, 10, 18).multiplyScalar(scale * fit);
  camera.far = 100 * scale * fit;
  camera.updateProjectionMatrix();
  orbit.target.set(centerX, 1.5, centerZ);
  orbit.maxDistance = 60 * scale * fit;
  orbit.update();
  directionalLight.position.set(4, 8, 3).multiplyScalar(scale);
  Object.assign(directionalLight.shadow.camera, {
    left: -8 * scale, right: 8 * scale, top: 8 * scale,
    bottom: -8 * scale, far: 25 * scale,
  });
  directionalLight.shadow.camera.updateProjectionMatrix();
  return { renderer, scene, camera, orbit, directionalLight, bounds, centerX, centerZ };
}
