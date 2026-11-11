import { Box3, Vector3 } from "three";
import { nudgeToFree } from "../physics/collision.js";
import { showMessage } from "../ui/toast.js";

/** Installs the furniture Move/Rotate/Resize/Remove menu and returns its DOM element. */
export function installContextMenu({ renderer, furniture, scene, drag, store, room, history }) {
  let target = null;

  const menu = document.createElement("div");
  menu.className = "ctx-menu";
  menu.setAttribute("role", "menu");
  menu.hidden = true;

  function close() {
    menu.hidden = true;
    target = null;
  }

  function open(x, y, item) {
    target = item;
    menu.hidden = false;
    menu.style.left = Math.min(x, window.innerWidth - menu.offsetWidth - 4) + "px";
    menu.style.top = Math.min(y, window.innerHeight - menu.offsetHeight - 4) + "px";
    menu.querySelector("button").focus({ preventScroll: true });
  }

  function addItem(label, hint, onSelect, className = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.setAttribute("role", "menuitem");
    const text = document.createElement("span");
    text.textContent = label;
    button.append(text);
    if (hint) {
      const key = document.createElement("kbd");
      key.textContent = hint;
      button.append(key);
    }
    button.addEventListener("click", (event) => {
      const item = target;
      const bounds = menu.getBoundingClientRect();
      close();
      if (item) onSelect(item, event, bounds);
    });
    menu.append(button);
  }

  function rotate(item) {
    const oldRot = item.rotation.y;
    const oldX = item.position.x;
    const oldZ = item.position.z;
    item.rotation.y += Math.PI / 2;
    if (!nudgeToFree(item, 1.5, room, furniture)) {
      item.rotation.y = oldRot;
      item.position.set(oldX, 0, oldZ);
      showMessage("No space to rotate here");
    } else {
      history?.record("furniture.rotate", {
        item,
        from: { rotation: oldRot, x: oldX, z: oldZ },
        to: { rotation: item.rotation.y, x: item.position.x, z: item.position.z },
      });
    }
  }

  addItem("Move", "Drag", (item, event) => drag.startDrag(item, event));
  addItem("Rotate 90°", "R", rotate);
  addItem("Resize…", "", (item, _event, bounds) => openDimensionDialog(item, bounds.left, bounds.top));
  addItem("Remove", "", (item) => {
    const index = furniture.indexOf(item);
    scene.remove(item);
    store.remove(item);
    history?.record("furniture.remove", { item, index });
    showMessage(`${item.userData.entry?.label ?? "Item"} removed`);
  }, "danger");
  document.body.append(menu);

  function openDimensionDialog(item, left, top) {
    item.updateMatrixWorld(true);
    const size = new Box3().setFromObject(item).getSize(new Vector3());
    const dialog = document.createElement("form");
    dialog.className = "dimension-dialog";
    dialog.style.left = `${Math.max(4, Math.min(left, window.innerWidth - 300))}px`;
    dialog.style.top = `${Math.max(4, Math.min(top, window.innerHeight - 270))}px`;

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
      input.type = "number";
      input.min = "0.001";
      input.step = "0.01";
      input.required = true;
      input.value = value.toFixed(2);
      row.append(input);
      dialog.append(row);
      return input;
    });

    const error = document.createElement("div");
    error.className = "error";
    error.setAttribute("role", "alert");
    dialog.append(error);

    const actions = document.createElement("div");
    actions.className = "dialog-actions";
    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "btn btn--quiet btn--small";
    cancelButton.textContent = "Cancel";
    const applyButton = document.createElement("button");
    applyButton.type = "submit";
    applyButton.className = "btn btn--small";
    applyButton.textContent = "Apply size";
    actions.append(cancelButton, applyButton);
    dialog.append(actions);
    document.body.append(dialog);
    inputs[0].focus();
    inputs[0].select();

    const closeDialog = () => dialog.remove();
    cancelButton.addEventListener("click", closeDialog);
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeDialog();
    });
    dialog.addEventListener("submit", (event) => {
      event.preventDefault();
      const dimensions = inputs.map((input) => Number(input.value));
      if (dimensions.some((value) => !Number.isFinite(value) || value <= 0)) {
        error.textContent = "Enter sizes greater than 0.";
        return;
      }

      const oldScale = { x: item.scale.x, y: item.scale.y, z: item.scale.z };
      item.scale.x *= dimensions[0] / size.x;
      item.scale.y *= dimensions[1] / size.y;
      item.scale.z *= dimensions[2] / size.z;
      history?.record("furniture.resize", {
        item,
        from: oldScale,
        to: { x: item.scale.x, y: item.scale.y, z: item.scale.z },
      });
      delete item.userData.fp;
      closeDialog();
    });
    dialog.addEventListener("pointerdown", (event) => event.stopPropagation());
  }

  function openAt(event) {
    if (drag.isDragging()) return;
    drag.setPointer(event);
    const item = drag.pick();
    if (item) open(event.clientX, event.clientY, item);
    else close();
  }

  renderer.domElement.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    openAt(event);
  });
  // Double-click opens the same menu, so touchpads and touch screens can reach it too.
  renderer.domElement.addEventListener("dblclick", (event) => {
    if (!drag.isDragging()) {
      drag.setPointer(event);
      const item = drag.pick();
      if (item) open(event.clientX, event.clientY, item);
    }
  });
  window.addEventListener("pointerdown", (event) => {
    if (!menu.contains(event.target)) close();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
  return menu;
}
