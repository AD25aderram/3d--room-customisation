/** Builds the catalog Add menu and calls onAdd(entry) when an option is selected. */
export function buildAddMenu(catalog, onAdd) {
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

  for (const entry of catalog) {
    const option = document.createElement("button");
    option.textContent = entry.label;
    option.addEventListener("click", () => {
      list.hidden = true;
      onAdd(entry);
    });
    list.append(option);
  }
  button.addEventListener("click", () => (list.hidden = !list.hidden));
  document.addEventListener("pointerdown", (event) => {
    if (!wrap.contains(event.target)) list.hidden = true;
  });

  wrap.append(button, list);
  document.body.append(wrap);
}
