/** Creates the per-app furniture collection used by placement and interaction modules. */
export function createFurnitureStore(onChange = () => {}) {
  const items = [];
  return {
    items,
    add(item) {
      items.push(item);
      onChange(items);
    },
    remove(item) {
      const index = items.indexOf(item);
      if (index !== -1) items.splice(index, 1);
      onChange(items);
    },
  };
}
