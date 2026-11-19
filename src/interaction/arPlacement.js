import { DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry } from "three";
import { showMessage } from "../ui/toast.js";

const isAndroidPhone = () =>
  /Android/i.test(navigator.userAgent) && /Mobile/i.test(navigator.userAgent);

export function createARPlacement({ renderer, scene, room, furniture, orbit, onStateChange }) {
  renderer.xr.enabled = true;

  const furnitureGroup = new Group();
  furnitureGroup.visible = false;
  scene.add(furnitureGroup);

  const reticle = new Mesh(
    new RingGeometry(0.08, 0.12, 32),
    new MeshBasicMaterial({ color: 0x20a464, side: DoubleSide, depthTest: false }),
  );
  reticle.matrixAutoUpdate = false;
  reticle.renderOrder = 2;
  reticle.visible = false;
  scene.add(reticle);

  const controller = renderer.xr.getController(0);
  scene.add(controller);

  let session = null;
  let hitTestSource = null;
  let localSpace = null;
  let preview = null;
  let hasHit = false;
  let previousRoomVisibility = true;
  let previousFurnitureVisibility = [];
  let previousOrbitEnabled = true;
  let previousPointerEvents = "";

  function restore() {
    hitTestSource?.cancel();
    hitTestSource = null;
    localSpace = null;
    preview = null;
    hasHit = false;
    furnitureGroup.clear();
    furnitureGroup.visible = false;
    reticle.visible = false;
    room.visible = previousRoomVisibility;
    previousFurnitureVisibility.forEach(([item, visible]) => {
      item.visible = visible;
    });
    previousFurnitureVisibility = [];
    orbit.enabled = previousOrbitEnabled;
    renderer.domElement.style.pointerEvents = previousPointerEvents;
    session = null;
    onStateChange(false);
  }

  function onSessionEnd() {
    restore();
  }

  function placeSelectedModel() {
    if (!session) return;
    if (!preview) {
      showMessage("Choose a furniture model from the catalog first.");
      return;
    }
    if (!hasHit) {
      showMessage("Aim your camera at a floor to place furniture.");
      return;
    }

    preview.visible = true;
    preview = null;
    hasHit = false;
    showMessage("Placed. Choose another model to add more.");
  }

  controller.addEventListener("select", placeSelectedModel);

  return {
    async isSupported() {
      if (!isAndroidPhone() || !window.isSecureContext || !navigator.xr?.isSessionSupported) {
        return false;
      }
      return navigator.xr.isSessionSupported("immersive-ar");
    },

    isActive() {
      return Boolean(session);
    },

    async start() {
      if (!isAndroidPhone() || !navigator.xr?.requestSession) {
        throw new Error("WebXR AR is available only on supported Android phones.");
      }
      if (session) return;

      const requestedSession = await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures: ["hit-test", "dom-overlay"],
        domOverlay: { root: document.body },
      });

      try {
        session = requestedSession;
        session.addEventListener("end", onSessionEnd, { once: true });
        renderer.xr.setReferenceSpaceType("local");
        await renderer.xr.setSession(session);
        const viewerSpace = await session.requestReferenceSpace("viewer");
        hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
        localSpace = await session.requestReferenceSpace("local");

        previousRoomVisibility = room.visible;
        previousFurnitureVisibility = furniture.map((item) => [item, item.visible]);
        previousOrbitEnabled = orbit.enabled;
        previousPointerEvents = renderer.domElement.style.pointerEvents;
        room.visible = false;
        furniture.forEach((item) => {
          item.visible = false;
        });
        furnitureGroup.visible = true;
        scene.add(reticle);
        orbit.enabled = false;
        renderer.domElement.style.pointerEvents = "none";
        onStateChange(true);
      } catch (error) {
        try {
          await requestedSession.end();
        } catch (endError) {
          console.error("Could not close the failed AR session:", endError);
        }
        throw error;
      }
    },

    async end() {
      if (session) await session.end();
    },

    select(model) {
      if (!session) return false;
      preview?.removeFromParent();
      preview = model;
      preview.visible = hasHit;
      furnitureGroup.add(preview);
      showMessage("Aim at the floor, then tap to place.");
      return true;
    },

    update(frame) {
      if (!session || !frame || !hitTestSource || !localSpace) return;

      const hit = frame.getHitTestResults(hitTestSource)[0];
      const pose = hit?.getPose(localSpace);
      if (!pose) {
        hasHit = false;
        reticle.visible = false;
        if (preview) preview.visible = false;
        return;
      }

      hasHit = true;
      reticle.matrix.fromArray(pose.transform.matrix);
      reticle.matrixWorldNeedsUpdate = true;
      reticle.visible = true;
      if (preview) {
        preview.position.set(
          pose.transform.position.x,
          pose.transform.position.y,
          pose.transform.position.z,
        );
        preview.visible = true;
      }
    },
  };
}
