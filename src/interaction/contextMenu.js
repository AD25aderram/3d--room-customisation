import { Box3, Vector3 } from "three";

/** Installs the furniture Drag/Scale/Remove context menu and returns its DOM element. */
export function installContextMenu({ renderer, furniture, scene, drag, store }) {
  let menu = null;
  let target = null;

  function close() {
    if (menu) menu.hidden = true;
    target = null;
  }

  function open(x, y, item) {
    target = item;
    menu.hidden = false;
    menu.style.left = Math.min(x, window.innerWidth - menu.offsetWidth - 4) + "px";
    menu.style.top = Math.min(y, window.innerHeight - menu.offsetHeight - 4) + "px";
  }

  const style = document.createElement("style");
  style.textContent = `
    .ctx-menu { position: fixed; z-index: 20; width: 120px; background: #fff; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,.35); font-family: system-ui, sans-serif; overflow: hidden; }
    .ctx-menu[hidden] { display: none; }
    .ctx-menu button { display: block; width: 100%; padding: 8px 14px; border: 0; background: none; color: #222; text-align: left; font-size: 14px; cursor: pointer; }
    .ctx-menu button:hover { background: #eef3fb; }
    .ctx-menu button.danger { color: #c62828; }
    .dimension-dialog { position: fixed; z-index: 21; width: 260px; padding: 16px; background: #fff; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,.35); font-family: system-ui, sans-serif; }
    .dimension-dialog h3 { margin: 0 0 12px; font-size: 16px; }
    .dimension-dialog label { display: flex; justify-content: space-between; align-items: center; margin: 8px 0; font-size: 14px; }
    .dimension-dialog input { width: 100px; padding: 4px; }
    .dimension-dialog .dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
    .dimension-dialog .dialog-actions button { padding: 6px 10px; border: 1px solid #bbb; border-radius: 4px; cursor: pointer; }
    .dimension-dialog .dialog-actions .primary { border-color: #2864c7; background: #2864c7; color: #fff; }
    .dimension-dialog .error { min-height: 16px; color: #c62828; font-size: 12px; }
  `;
  document.head.append(style);

  menu = document.createElement("div");
  menu.className = "ctx-menu";
  menu.hidden = true;

  const dragButton = document.createElement("button");
  dragButton.textContent = "Drag";
  dragButton.addEventListener("click", (event) => {
    const item = target;
    close();
    if (item) drag.startDrag(item, event);
  });

  const scaleButton = document.createElement("button");
  scaleButton.textContent = "Scale";
  scaleButton.addEventListener("click", () => {
    const item = target;
    const bounds = menu.getBoundingClientRect();
    close();
    if (item) openDimensionDialog(item, bounds.left, bounds.top);
  });

  const removeButton = document.createElement("button");
  removeButton.textContent = "Remove";
  removeButton.className = "danger";
  removeButton.addEventListener("click", () => {
    const item = target;
    close();
    if (item) {
      scene.remove(item);
      store.remove(item);
    }
  });

  menu.append(dragButton, scaleButton, removeButton);
  document.body.append(menu);

  function openDimensionDialog(item, left, top) {
    item.updateMatrixWorld(true);
    const size = new Box3().setFromObject(item).getSize(new Vector3());
    const dialog = document.createElement("form");
    dialog.className = "dimension-dialog";
    dialog.style.left = `${Math.max(4, Math.min(left, window.innerWidth - 268))}px`;
    dialog.style.top = `${Math.max(4, Math.min(top, window.innerHeight - 250))}px`;

    const title = document.createElement("h3");
    title.textContent = "Object dimensions";
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
      input.step = "0.001";
      input.required = true;
      input.value = value.toFixed(2);
      row.append(input);
      dialog.append(row);
      return input;
    });

    const error = document.createElement("div");
    error.className = "error";
    dialog.append(error);

    const actions = document.createElement("div");
    actions.className = "dialog-actions";
    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.textContent = "Cancel";
    const applyButton = document.createElement("button");
    applyButton.type = "submit";
    applyButton.className = "primary";
    applyButton.textContent = "Apply";
    actions.append(cancelButton, applyButton);
    dialog.append(actions);
    document.body.append(dialog);

    const closeDialog = () => dialog.remove();
    cancelButton.addEventListener("click", closeDialog);
    dialog.addEventListener("submit", (event) => {
      event.preventDefault();
      const dimensions = inputs.map((input) => Number(input.value));
      if (dimensions.some((value) => !Number.isFinite(value) || value <= 0)) {
        error.textContent = "Enter positive dimensions.";
        return;
      }

      item.scale.x *= dimensions[0] / size.x;
      item.scale.y *= dimensions[1] / size.y;
      item.scale.z *= dimensions[2] / size.z;
      delete item.userData.fp;
      closeDialog();
    });
    dialog.addEventListener("pointerdown", (event) => event.stopPropagation());
  }

  renderer.domElement.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    if (drag.isDragging()) return;
    drag.setPointer(event);
    const item = drag.pick();
    if (item) open(event.clientX, event.clientY, item);
    else close();
  });
  window.addEventListener("pointerdown", (event) => {
    if (!menu.contains(event.target)) close();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
  return menu;
}
