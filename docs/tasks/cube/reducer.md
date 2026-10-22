---
title: Picker reducer
status: todo
deps: [cube/model, cube/axis]
summary: PickerState, PickerAction, pickerReducer in state.ts
---

# Picker reducer

## Goal

All picker behavior as one pure reducer, so every interaction is testable without
the DOM and transitions can compute their target before anything moves.

## Design

Spec [§3.6](../../hsl-picker/design-spec.md#36-picker-state). File `src/hsl/state.ts`.

- `PickerState { face, selection, lattice, center, zoom, expanded }`, where
  `lattice` is the stored axis lattice per grid variable (`cube/axis`).
- `PickerAction`: `pick`, `reachEnd`, `setDepth`, `turn`, `zoom`,
  `toggleExpanded`, `move`.
- `initialPickerState(initial?)` — START_FACE, zoom 0, collapsed, default
  hsl(210 64% 56%), with the lattice laid from the selection.
- Rules:
  - `turn` collapses the panel.
  - `turn` and `zoom` lay the lattice from the selection and reset `center` to it.
  - `zoom` clamps to 0–4, and a no-op returns the same object.
  - `move` steps one patch, and scrolls the window one lattice step at the edge
    (Deviation from requirements); S/L stop at 0 and 100.
  - When a `move` lands on an edge patch less than one step from an S/L end, the
    edge rule lays the lattice on that end at once.
  - `pick` never changes `center` or the lattice.
  - `reachEnd` applies the edge rule after a pick, and returns the same object when
    the rule doesn't apply.
  - Stored colors go through `roundHsl`.
- Rework the uncommitted draft on top of `cube/axis`. Its edge scroll re-derives
  `steps` and `half`; with the lattice stored explicitly that isn't needed. The
  review's "off-lattice value on the other axis" case can't happen any more,
  because the selection is always on both lattices.

## How to Verify

`vp test` passes, covering every action and each rule above, including:

- `zoom` at the limits returns the identical state object.
- Edge scrolls work in all four directions, including down from a window pinned at
  S/L 100 and left across hue 0.
- The edge rule fires for a `move` onto an edge patch and for `reachEnd`, and doesn't
  fire when the end is a whole step away.
- After any `pick` or `move`, the selection is on the stored lattice.
