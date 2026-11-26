# Floorplot 3D Room Customizer

## ES module layout

- `src/main.js` wires the app modules together
- `src/config.js` contains placement and display settings.
- `src/core/` creates the renderer, camera, controls, lights, and helpers.
- `src/room/` loads drawn or default rooms and updates wall visibility. `src/custom_model.js` builds rooms drawn on the canvas page.
- `src/physics/geometry.js` contains pure floor polygon and rectangle helpers; `collision.js` applies them to room and furniture data.
- `src/furniture/` contains the catalog, GLTF model loader, furniture store, and placement search.
- `src/interaction/` handles dragging, rotation, and the right-click menu.
- `src/ui/` contains the Add menu and toast message.
- `src/canvas.js` remains a separate page script and saves the drawn room in session storage.

Dependencies flow from core room and physics utilities toward furniture; interaction and UI use those modules, and `main.js` connects the app. `physics/geometry.js` has no Three.js or DOM dependency.

## Adding furniture

The furniture picker builds its searchable categories from `MODEL_GROUPS` in `src/furniture/catalog.js`. Add each model filename to its category's `files` list and set a target `width` or `height` in scene units for the group. Model paths are URL-encoded and resolved relative to the editor page. The loader supports the Draco-compressed catalog models.

## Android AR preview

On a supported Android phone, the homepage offers an AR preview link when the browser reports `immersive-ar` support. Open the editor, tap **Start AR**, allow camera access, choose a catalog model, aim at a floor, and tap to place it. Tap a placed model to move it (aim and tap to drop), rotate it, resize it, or delete it. Collapse or expand the catalog with its **Hide**/**Show** button. The preview requires a secure HTTPS origin, Android Chrome/WebXR support for hit testing and DOM overlays, and a compatible ARCore device. AR placements are temporary and are cleared when the AR session ends.

## SEO and deployment

`index.html` is the public landing page. The preset, drawing, and editor pages are marked `noindex`; `robots.txt` allows crawlers to read those directives. The canonical URL, social metadata, `robots.txt`, and `sitemap.xml` use the production URL `https://floorplot.vercel.app/`. The 1200 × 630 social preview image is `og-image.png`.

## Items noticed and left unchanged

- The fallback path assumes room builders provide a non-empty `userData.outline`; malformed room geometry can still fail while bounds are calculated.
- `canvas.js` retains its original drawing and session storage flow, including its console logging.
- The GLTF catalog paths use `../models/...` as in the existing app; their resolution depends on the static server's page URL layout.
gltf-transform optimize input.glb output.glb --compress draco --texture-compress webp