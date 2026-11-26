import {
  Box3, DoubleSide, Group, Mesh, MeshBasicMaterial, Quaternion, Raycaster,
  RingGeometry, Vector3,
} from "three";
import { showMessage } from "../ui/toast.js";

const isAndroidPhone = () =>
  /Android/i.test(navigator.userAgent) && /Mobile/i.test(navigator.userAgent);
const MIN_FLOOR_NORMAL_Y = Math.cos(20 * Math.PI / 180);

export function createARPlacement({ renderer, scene, room, furniture, orbit, onStateChange }) {
  renderer.xr.enabled = true;

  const furnitureGroup = new Group();
  furnitureGroup.visible = false;
  scene.add(furnitureGroup);

  const reticleMaterial = new MeshBasicMaterial({
    color: 0x20a464, side: DoubleSide, depthTest: false,
  });
  const reticle = new Mesh(
    new RingGeometry(0.08, 0.12, 32).rotateX(-Math.PI / 2),
    reticleMaterial,
  );
  reticle.matrixAutoUpdate = false;
  reticle.renderOrder = 2;
  reticle.visible = false;
  scene.add(reticle);

  const controller = renderer.xr.getController(0);
  scene.add(controller);

  const tools = document.createElement("section");
  tools.className = "ar-object-tools";
  tools.hidden = true;
  tools.setAttribute("aria-label", "Selected furniture controls");
  const toolsLabel = document.createElement("p");
  toolsLabel.className = "ar-object-tools__label";
  const actions = document.createElement("div");
  actions.className = "ar-object-tools__actions";
  const addButton = (text, className = "btn btn--quiet btn--small") => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = text;
    actions.append(button);
    return button;
  };
  const moveButton = addButton("Move");
  const cancelMoveButton = addButton("Cancel move");
  const rotateButton = addButton("Rotate 90°");
  const resizeButton = addButton("Resize");
  const deleteButton = addButton("Delete", "btn btn--quiet btn--small is-danger");
  tools.append(toolsLabel, actions);
  document.body.append(tools);

  let session = null;
  let hitTestSource = null;
  let localSpace = null;
  let preview = null;
  let selectedItem = null;
  let movingItem = null;
  let moveStart = null;
  let resizeDialog = null;
  let currentHit = null;
  let hasValidHit = false;
  let previousRoomVisibility = true;
  let previousFurnitureVisibility = [];
  let previousOrbitEnabled = true;
  let previousPointerEvents = "";
  const placedItems = new Set();
  const raycaster = new Raycaster();
  const rayOrigin = new Vector3();
  const rayDirection = new Vector3(0, 0, -1);
  const rayRotation = new Quaternion();
  const hitPosition = new Vector3();
  const surfaceNormal = new Vector3(0, 1, 0);
  const hitRotation = new Quaternion();
  const itemAnchors = new Map();
  const anchorRequests = new Map();

  function clearAnchor(item) {
    const anchor = itemAnchors.get(item);
    if (anchor) anchor.delete();
    itemAnchors.delete(item);
    anchorRequests.set(item, (anchorRequests.get(item) ?? 0) + 1);
  }

  function anchorAtHit(item, hit) {
    clearAnchor(item);
    if (typeof hit?.createAnchor !== "function") return;

    const version = anchorRequests.get(item);
    const anchorSession = session;
    let anchorPromise;
    try {
      anchorPromise = hit.createAnchor();
    } catch (error) {
      console.warn("Could not anchor the AR furniture; keeping its tracked position:", error);
      return;
    }

    Promise.resolve(anchorPromise)
      .then((anchor) => {
        if (session !== anchorSession || !placedItems.has(item) ||
            anchorRequests.get(item) !== version) {
          anchor.delete();
          return;
        }
        itemAnchors.set(item, anchor);
      })
      .catch((error) => {
        console.warn("Could not anchor the AR furniture; keeping its tracked position:", error);
      });
  }

  function updateTools() {
    const item = movingItem ?? selectedItem;
    tools.hidden = !session || !item;
    if (!item) return;

    toolsLabel.textContent = movingItem
      ? `Moving ${item.userData.entry?.label ?? "furniture"} · aim and tap to place`
      : item.userData.entry?.label ?? "Furniture selected";
    moveButton.hidden = Boolean(movingItem);
    cancelMoveButton.hidden = !movingItem;
    rotateButton.hidden = Boolean(movingItem);
    resizeButton.hidden = Boolean(movingItem);
    deleteButton.hidden = Boolean(movingItem);
  }

  function closeResizeDialog() {
    resizeDialog?.remove();
    resizeDialog = null;
  }

  function openResizeDialog(item) {
    closeResizeDialog();
    item.updateMatrixWorld(true);
    const size = new Box3().setFromObject(item).getSize(new Vector3());
    const dialog = document.createElement("form");
    dialog.className = "dimension-dialog ar-resize-dialog";
    const title = document.createElement("h3");
    title.textContent = "Resize";
    dialog.append(title);

    const inputs = [
      ["Width", size.x],
      ["Height", size.y],
      ["Depth", size.z],
    ].map(([label, value]) => {
      const row = document.createElement("label");
      row.textContent = `${label} (m)`;
      const input = document.createElement("input");
      input.type = "text";
      input.inputMode = "decimal";
      input.value = Number(value).toFixed(2);
      row.append(input);
      dialog.append(row);
      return input;
    });

    const error = document.createElement("div");
    error.className = "error";
    error.setAttribute("role", "alert");
    dialog.append(error);

    const dialogActions = document.createElement("div");
    dialogActions.className = "dialog-actions";
    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "btn btn--quiet btn--small";
    cancelButton.textContent = "Cancel";
    const applyButton = document.createElement("button");
    applyButton.type = "submit";
    applyButton.className = "btn btn--small";
    applyButton.textContent = "Apply size";
    dialogActions.append(cancelButton, applyButton);
    dialog.append(dialogActions);
    document.body.append(dialog);
    resizeDialog = dialog;

    cancelButton.addEventListener("click", closeResizeDialog);
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeResizeDialog();
    });
    dialog.addEventListener("pointerdown", (event) => event.stopPropagation());
    dialog.addEventListener("submit", (event) => {
      event.preventDefault();
      const dimensions = inputs.map((input) =>
        Number.parseFloat(input.value.trim().replace(/,/g, ".")));
      if (dimensions.some((value) => !Number.isFinite(value) || value <= 0)) {
        error.textContent = "Enter sizes greater than 0.";
        return;
      }

      item.scale.set(
        item.scale.x * dimensions[0] / size.x,
        item.scale.y * dimensions[1] / size.y,
        item.scale.z * dimensions[2] / size.z,
      );
      delete item.userData.fp;
      closeResizeDialog();
    });
  }

  function cancelMove() {
    if (!movingItem) return;
    movingItem.position.copy(moveStart);
    selectedItem = movingItem;
    movingItem = null;
    moveStart = null;
    reticle.visible = false;
    updateTools();
  }

  function pickPlacedItem() {
    controller.updateMatrixWorld(true);
    controller.getWorldPosition(rayOrigin);
    controller.getWorldQuaternion(rayRotation);
    raycaster.set(rayOrigin, rayDirection.clone().applyQuaternion(rayRotation).normalize());
    const hit = raycaster.intersectObjects([...placedItems], true)[0];
    let item = hit?.object ?? null;
    while (item && !placedItems.has(item)) item = item.parent;
    return item;
  }

  function placeOrSelect() {
    if (!session) return;
    if (movingItem) {
      if (!hasValidHit) {
        showMessage("Aim at a level floor surface, then tap to drop the model.");
        return;
      }
      const item = movingItem;
      selectedItem = movingItem;
      movingItem = null;
      moveStart = null;
      anchorAtHit(item, currentHit);
      reticle.visible = false;
      updateTools();
      showMessage("Model moved.");
      return;
    }

    if (preview) {
      if (!hasValidHit) {
        showMessage("Aim at a level floor surface to place furniture.");
        return;
      }
      preview.visible = true;
      preview.userData.isARPlaced = true;
      placedItems.add(preview);
      anchorAtHit(preview, currentHit);
      selectedItem = preview;
      preview = null;
      reticle.visible = false;
      updateTools();
      showMessage("Placed. Tap a model to edit it, or choose another from the catalog.");
      return;
    }

    selectedItem = pickPlacedItem();
    updateTools();
  }

  function restore() {
    hitTestSource?.cancel();
    hitTestSource = null;
    localSpace = null;
    preview = null;
    selectedItem = null;
    movingItem = null;
    moveStart = null;
    for (const anchor of itemAnchors.values()) anchor.delete();
    itemAnchors.clear();
    anchorRequests.clear();
    currentHit = null;
    hasValidHit = false;
    placedItems.clear();
    closeResizeDialog();
    tools.hidden = true;
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

  moveButton.addEventListener("click", () => {
    if (!selectedItem) return;
    movingItem = selectedItem;
    moveStart = selectedItem.position.clone();
    selectedItem = null;
    reticle.visible = false;
    updateTools();
    showMessage("Aim where you want the model, then tap to drop it.");
  });
  cancelMoveButton.addEventListener("click", cancelMove);
  rotateButton.addEventListener("click", () => {
    if (!selectedItem) return;
    selectedItem.rotation.y += Math.PI / 2;
  });
  resizeButton.addEventListener("click", () => {
    if (selectedItem) openResizeDialog(selectedItem);
  });
  deleteButton.addEventListener("click", () => {
    if (!selectedItem) return;
    clearAnchor(selectedItem);
    placedItems.delete(selectedItem);
    selectedItem.removeFromParent();
    selectedItem = null;
    updateTools();
    showMessage("Furniture removed.");
  });
  controller.addEventListener("select", placeOrSelect);

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
        optionalFeatures: ["anchors"],
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
      cancelMove();
      preview?.removeFromParent();
      selectedItem = null;
      preview = model;
      preview.visible = hasValidHit;
      furnitureGroup.add(preview);
      updateTools();
      showMessage("Aim at a level floor surface, then tap to place.");
      return true;
    },

    update(frame) {
      if (!session || !frame || !hitTestSource || !localSpace) return;

      for (const [item, anchor] of itemAnchors) {
        if (item === movingItem) continue;
        const anchorPose = frame.getPose(anchor.anchorSpace, localSpace);
        if (anchorPose) {
          item.position.set(
            anchorPose.transform.position.x,
            anchorPose.transform.position.y,
            anchorPose.transform.position.z,
          );
        }
      }

      const hit = frame.getHitTestResults(hitTestSource)[0];
      const pose = hit?.getPose(localSpace);
      if (!pose) {
        currentHit = null;
        hasValidHit = false;
        reticle.visible = false;
        if (preview) preview.visible = false;
        return;
      }

      currentHit = hit;
      hitPosition.set(
        pose.transform.position.x,
        pose.transform.position.y,
        pose.transform.position.z,
      );
      hitRotation.set(
        pose.transform.orientation.x,
        pose.transform.orientation.y,
        pose.transform.orientation.z,
        pose.transform.orientation.w,
      );
      surfaceNormal.set(0, 1, 0).applyQuaternion(hitRotation);
      hasValidHit = surfaceNormal.y >= MIN_FLOOR_NORMAL_Y;
      reticle.matrix.fromArray(pose.transform.matrix);
      reticle.matrixWorldNeedsUpdate = true;
      reticleMaterial.color.set(hasValidHit ? 0x20a464 : 0xe5484d);
      reticle.visible = Boolean(preview || movingItem);
      if (preview && hasValidHit) {
        preview.position.copy(hitPosition);
        preview.visible = true;
      }
      if (preview && !hasValidHit) preview.visible = false;
      if (movingItem && hasValidHit) movingItem.position.copy(hitPosition);
    },
  };
}
