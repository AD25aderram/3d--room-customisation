/** Creates the per-app furniture collection used by placement and interaction modules. */
export function createFurnitureStore() {
  const items = [];
  return {
    items,
    add(item) {
      items.push(item);
    },
    remove(item) {
      const index = items.indexOf(item);
      if (index !== -1) items.splice(index, 1);
    },
  };
}
