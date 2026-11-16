const svg = (inner) =>
  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

const ICONS = {
  sofa: svg('<path d="M5 11V9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2"/><path d="M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v4H3z"/><path d="M6 17v2M18 17v2"/>'),
  bed: svg('<path d="M3 18V8M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.6"/>'),
  lamp: svg('<path d="M8 4h8l2 7H6z"/><path d="M12 11v8M8.5 19h7"/>'),
  desk: svg('<rect x="3" y="7" width="18" height="3" rx="1"/><path d="M6 10v9M18 10v9M9 7V4h6v3"/>'),
  chair: svg('<path d="M6 11V8a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v3"/><path d="M4 12a2 2 0 0 1 4 0v3h8v-3a2 2 0 0 1 4 0v5H4z"/><path d="M7 17v3M17 17v3"/>'),
  other: svg('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>'),
};

const ICON_BY_CATEGORY = {
  beds: "bed",
  chairs: "chair",
  "desks & tables": "desk",
  lighting: "lamp",
  plants: "other",
  sofas: "sofa",
  imported: "other",
};

function sizeLabel(entry) {
  if (entry.height) return `${entry.height} m tall`;
  return `${entry.width ?? 2} m wide`;
}

/** Builds the furniture dock, calling onAdd(entry) or onImport(file, addEntry) as selected. */
export function buildAddMenu(catalog, onAdd, onImport) {
  const dock = document.createElement("aside");
  dock.className = "dock";
  dock.setAttribute("aria-label", "Furniture catalog");

  const head = document.createElement("button");
  head.type = "button";
  head.className = "dock-head";
  head.setAttribute("aria-expanded", "true");

  const title = document.createElement("span");
  title.textContent = "Choose furniture";
  const count = document.createElement("span");
  count.className = "dock-count";
  count.textContent = `${catalog.length} models`;
  head.append(title, count);
  head.addEventListener("click", () => {
    const collapsed = dock.classList.toggle("is-collapsed");
    head.setAttribute("aria-expanded", String(!collapsed));
  });

  const body = document.createElement("div");
  body.className = "dock-body";
  const tools = document.createElement("div");
  tools.className = "catalog-tools";

  const search = document.createElement("input");
  search.type = "search";
  search.className = "catalog-search";
  search.placeholder = "Search furniture";
  search.setAttribute("aria-label", "Search furniture");

  const categoryFilter = document.createElement("select");
  categoryFilter.className = "catalog-filter";
  categoryFilter.setAttribute("aria-label", "Filter by furniture category");
  const allCategories = document.createElement("option");
  allCategories.value = "";
  allCategories.textContent = "All categories";
  categoryFilter.append(allCategories);

  const summary = document.createElement("p");
  summary.className = "catalog-summary";
  summary.setAttribute("aria-live", "polite");

  const list = document.createElement("ul");
  list.className = "pieces";
  list.setAttribute("aria-label", "Furniture models");
  const emptyState = document.createElement("li");
  emptyState.className = "empty-state";
  emptyState.textContent = "No furniture matches your search.";

  const importButton = document.createElement("button");
  importButton.type = "button";
  importButton.className = "import";
  importButton.textContent = "Import a custom GLB";
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".glb,model/gltf-binary";
  fileInput.hidden = true;

  const entries = [...catalog];
  const categories = new Set();
  function addCategoryOption(entry) {
    const category = entry.category ?? (entry.file ? "Imported" : "Furniture");
    if (categories.has(category)) return;
    categories.add(category);
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilter.append(option);
  }
  entries.forEach(addCategoryOption);

  function renderEntries() {
    const query = search.value.trim().toLocaleLowerCase();
    const category = categoryFilter.value;
    count.textContent = `${entries.length} models`;
    const matching = entries.filter((entry) => {
      const entryCategory = entry.category ?? (entry.file ? "Imported" : "Furniture");
      const matchesCategory = !category || entryCategory === category;
      const matchesQuery = !query || `${entry.label} ${entryCategory}`.toLocaleLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });

    list.replaceChildren();
    for (const entry of matching) {
      const item = document.createElement("li");
      const option = document.createElement("button");
      option.type = "button";
      option.className = "piece";
      option.title = `Place ${entry.label}`;

      const icon = document.createElement("span");
      icon.className = "piece-icon";
      const iconName = ICON_BY_CATEGORY[(entry.category ?? "imported").toLocaleLowerCase()] ?? "other";
      icon.innerHTML = ICONS[iconName];

      const text = document.createElement("span");
      text.className = "piece-text";
      const name = document.createElement("span");
      name.className = "piece-name";
      name.textContent = entry.label;
      const details = document.createElement("span");
      details.className = "piece-size";
      details.textContent = `${entry.category ? `${entry.category} · ` : ""}${sizeLabel(entry)}`;
      text.append(name, details);

      const action = document.createElement("span");
      action.className = "piece-action";
      action.textContent = "Add";

      option.append(icon, text, action);
      option.addEventListener("click", () => {
        option.disabled = true;
        option.classList.add("is-loading");
        action.textContent = "…";
        details.textContent = "Loading model";
        Promise.resolve(onAdd(entry)).finally(() => {
          option.disabled = false;
          option.classList.remove("is-loading");
          action.textContent = "Add";
          details.textContent = `${entry.category ? `${entry.category} · ` : ""}${sizeLabel(entry)}`;
        });
      });

      item.append(option);
      list.append(item);
    }

    if (matching.length === 0) list.append(emptyState);
    summary.textContent = category || query
      ? `${matching.length} of ${entries.length} models`
      : `${entries.length} models`;
  }

  search.addEventListener("input", renderEntries);
  categoryFilter.addEventListener("change", renderEntries);
  importButton.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (file) onImport(file, addEntry);
  });

  function addEntry(entry) {
    entries.push(entry);
    addCategoryOption(entry);
    search.value = "";
    categoryFilter.value = "";
    renderEntries();
  }

  tools.append(search, categoryFilter, summary);
  body.append(tools, list, importButton, fileInput);
  dock.append(head, body);
  document.body.append(dock);
  renderEntries();
  return { addEntry };
}
