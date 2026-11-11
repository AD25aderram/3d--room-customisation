# Undo behavior catalogue

The initial room is the history base. It is not an undoable action, and camera movement is not recorded.

`behaviorCatalog.js` is the canonical catalogue. Each entry names a user behavior and defines the reverse operation (plus a forward operation for future redo support). To add an undoable behavior:

1. Add its type, label, `undo`, and `redo` handlers to `BEHAVIOR_CATALOG`.
2. At the point where the user commits the change, call `history.record(type, data)` with the item and the before/after values the handler needs.
3. For continuous gestures, record one completed gesture, not every pointer-move frame. Do not record previews that are canceled.

Current behaviors:

| Type | Undo effect |
| --- | --- |
| `furniture.place` | Removes the newly placed piece |
| `furniture.move` | Restores its previous floor position |
| `furniture.rotate` | Restores its previous rotation and floor position |
| `furniture.resize` | Restores its previous scale |
| `furniture.remove` | Restores the removed piece at its prior list position |
