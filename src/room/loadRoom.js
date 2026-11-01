import { buildCustomRoom } from "../custom_model.js";
import { buildDefaultRoom } from "./defaultRoom.js";

/** Loads sessionStorage room data or returns the default room when absent or invalid. */
export function loadRoom() {
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
