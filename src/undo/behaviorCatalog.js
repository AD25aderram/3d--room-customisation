/**
 * Canonical list of undoable room behaviors. Add a behavior here, then record it
 * through history.record(type, data) when the user's change is committed.
 * Camera controls are intentionally absent from this catalog.
 */
export const BEHAVIOR_CATALOG = Object.freeze({
  "furniture.place": {
    label: "Place furniture",
    undo: ({ item }, { scene, store }) => removeItem(item, scene, store),
    redo: ({ item, index }, { scene, store }) => restoreItem(item, index, scene, store),
  },
  "furniture.move": {
    label: "Move furniture",
    undo: ({ item, from }, { setPosition }) => setPosition(item, from),
    redo: ({ item, to }, { setPosition }) => setPosition(item, to),
  },
  "furniture.rotate": {
    label: "Rotate furniture",
    undo: ({ item, from }, { setPose }) => setPose(item, from),
    redo: ({ item, to }, { setPose }) => setPose(item, to),
  },
  "furniture.resize": {
    label: "Resize furniture",
    undo: ({ item, from }, { setScale }) => setScale(item, from),
    redo: ({ item, to }, { setScale }) => setScale(item, to),
  },
  "furniture.remove": {
    label: "Remove furniture",
    undo: ({ item, index }, { scene, store }) => restoreItem(item, index, scene, store),
    redo: ({ item }, { scene, store }) => removeItem(item, scene, store),
  },
});

function removeItem(item, scene, store) {
  scene.remove(item);
  store.remove(item);
}

function restoreItem(item, index, scene, store) {
  scene.add(item);
  store.add(item, index);
}

export function createBehaviorHistory({ scene, store, onChange = () => {} }) {
  const stack = [];
  const context = {
    scene,
    store,
    setPosition(item, position) {
      item.position.set(position.x, 0, position.z);
    },
    setPose(item, pose) {
      item.rotation.y = pose.rotation;
      item.position.set(pose.x, 0, pose.z);
    },
    setScale(item, scale) {
      item.scale.set(scale.x, scale.y, scale.z);
      delete item.userData.fp;
    },
  };

  return {
    record(type, data) {
      if (!BEHAVIOR_CATALOG[type]) throw new Error(`Unknown undo behavior: ${type}`);
      stack.push({ type, data });
      onChange(stack.length > 0, BEHAVIOR_CATALOG[type].label);
    },
    undo() {
      const action = stack.pop();
      if (!action) return false;
      BEHAVIOR_CATALOG[action.type].undo(action.data, context);
      onChange(stack.length > 0, stack.length ? BEHAVIOR_CATALOG[stack.at(-1).type].label : "");
      return true;
    },
    canUndo() {
      return stack.length > 0;
    },
    get length() {
      return stack.length;
    },
  };
}
