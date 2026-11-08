const svg = (inner) =>
  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

const ICONS = {
  sofa: svg('<path d="M5 11V9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2"/><path d="M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v4H3z"/><path d="M6 17v2M18 17v2"/>'),
  table: svg('<rect x="3" y="8" width="18" height="3" rx="1"/><path d="M6 11v8M18 11v8"/>'),
  bed: svg('<path d="M3 18V8M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.6"/>'),
  lamp: svg('<path d="M8 4h8l2 7H6z"/><path d="M12 11v8M8.5 19h7"/>'),
  desktop: svg('<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M9 20h6M12 16v4"/>'),
  chair: svg('<path d="M6 11V8a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v3"/><path d="M4 12a2 2 0 0 1 4 0v3h8v-3a2 2 0 0 1 4 0v5H4z"/><path d="M7 17v3M17 17v3"/>'),
  other: svg('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>'),
};

function sizeLabel(entry) {
  if (entry.height) return `${entry.height} m tall`;
  return `${entry.width ?? 2} m wide`;
}

/** Builds the furniture dock, calling onAdd(entry) or onImport(file, addEntry) as selected. */
export function buildAddMenu(catalog, onAdd, onImport) {
  const dock = document.createElement("aside");
  dock.className = "dock";
  dock.setAttribute("aria-label", "Furniture");

  const head = document.createElement("button");
  head.type = "button";
  head.className = "dock-head";
  head.textContent = "Furniture";
  head.setAttribute("aria-expanded", "true");
  head.addEventListener("click", () => {
    const collapsed = dock.classList.toggle("is-collapsed");
    head.setAttribute("aria-expanded", String(!collapsed));
  });

  const body = document.createElement("div");
  body.className = "dock-body";
  const list = document.createElement("ul");
  list.className = "pieces";

  const importButton = document.createElement("button");
  importButton.type = "button";
  importButton.className = "import";
  importButton.textContent = "Import a .glb model";
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".glb,model/gltf-binary";
  fileInput.hidden = true;

  function addEntry(entry) {
    const item = document.createElement("li");
    const option = document.createElement("button");
    option.type = "button";
    option.className = "piece";

    const icon = document.createElement("span");
    icon.className = "piece-icon";
    icon.innerHTML = ICONS[entry.id] ?? ICONS.other;
    const text = document.createElement("span");
    const name = document.createElement("span");
    name.className = "piece-name";
    name.textContent = entry.label; // textContent: imported file names are untrusted
    const size = document.createElement("span");
    size.className = "piece-size";
    size.textContent = sizeLabel(entry);
    text.append(name, size);
    option.append(icon, text);

    option.addEventListener("click", () => {
      option.disabled = true;
      option.classList.add("is-loading");
      size.textContent = "Adding…";
      Promise.resolve(onAdd(entry)).finally(() => {
        option.disabled = false;
        option.classList.remove("is-loading");
        size.textContent = sizeLabel(entry);
      });
    });
    item.append(option);
    list.append(item);
  }

  for (const entry of catalog) addEntry(entry);
  importButton.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (file) onImport(file, addEntry);
  });

  body.append(list, importButton, fileInput);
  dock.append(head, body);
  document.body.append(dock);
  return { addEntry };
}
