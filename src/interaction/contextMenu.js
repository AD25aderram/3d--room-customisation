/** Installs the furniture Drag/Remove context menu and returns its DOM element. */
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
  menu.append(dragButton, removeButton);
  document.body.append(menu);

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
