import { buildCustomRoom } from "../custom_model.js";

const PIXELS_PER_METRE = 50;

function rectanglePoints(width, depth) {
    const halfWidth = width * PIXELS_PER_METRE / 2;
    const halfDepth = depth * PIXELS_PER_METRE / 2;
    return [
        { x: -halfWidth, y: -halfDepth },
        { x: halfWidth, y: -halfDepth },
        { x: halfWidth, y: halfDepth },
        { x: -halfWidth, y: halfDepth }
    ];
}

function cylinderPoints(radius) {
    const points = [];
    const radiusInPixels = radius * PIXELS_PER_METRE;

    for (let index = 0; index < 64; index += 1) {
        const angle = (index / 64) * Math.PI * 2;
        points.push({
            x: Math.cos(angle) * radiusInPixels,
            y: Math.sin(angle) * radiusInPixels
        });
    }

    return points;
}

/** Builds a room from the dimensions saved by the preset form. */
export function buildPresetRoom(preset) {
    const width = Number(preset.width);
    const depth = Number(preset.depth);
    const length = Number(preset.length);
    const radius = Number(preset.radius);

    if (preset.shape === "cylinder" && radius > 0) {
        return buildCustomRoom(cylinderPoints(radius), []);
    }

    if (preset.shape === "square" && length > 0) {
        return buildCustomRoom(rectanglePoints(length, length), []);
    }

    if (width > 0 && depth > 0) {
        return buildCustomRoom(rectanglePoints(width, depth), []);
    }

    throw new Error("Invalid preset room dimensions");
}
