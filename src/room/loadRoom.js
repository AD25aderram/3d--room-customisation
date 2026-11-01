import { buildCustomRoom } from "../custom_model.js";
import { buildDefaultRoom } from "./defaultRoom.js";
import { buildPresetRoom } from "./presetRoom.js";

/** Loads sessionStorage room data or returns the default room when absent or invalid. */
export function loadRoom() {
  const preset = sessionStorage.getItem("presetRoom");
  if (preset) {
    try {
      return buildPresetRoom(JSON.parse(preset));
    } catch (error) {
      console.error("Bad presetRoom data:", error);
      sessionStorage.removeItem("presetRoom");
    }
  }

  const saved = sessionStorage.getItem("customRoom");
  if (saved) {
    try {
      const { points, pillars } = JSON.parse(saved);
      if (points && points.length >= 3) {
        return buildCustomRoom(points, pillars ?? []);
      }
    } catch (error) {
      console.error("Bad customRoom data:", error);
    }
  }
  return buildDefaultRoom();
}
