/** Creates the per-app furniture collection used by placement and interaction modules. */
export function createFurnitureStore(onChange = () => {}) {
  const items = [];
  return {
    items,
    add(item, index = items.length) {
      if (items.includes(item)) return;
      items.splice(Math.max(0, Math.min(index, items.length)), 0, item);
      onChange(items);
    },
    remove(item) {
      const index = items.indexOf(item);
      if (index !== -1) {
        items.splice(index, 1);
        onChange(items);
      }
      return index;
    },
  };
}
