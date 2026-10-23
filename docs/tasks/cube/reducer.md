---
title: Picker reducer
status: done
deps: [cube/model, cube/axis]
summary: PickerState, PickerAction, pickerReducer in state.ts
done: "2026-10-22 #16"
---

# Picker reducer

## Goal

All picker behavior as one pure reducer, so every interaction is testable without
the DOM and transitions can compute their target before anything moves.

## Design

Spec [§3.6](../../hsl-picker/design-spec.md#36-picker-state). File `src/hsl/state.ts`.

- `PickerState { face, selection, lattice, center, zoom, expanded }`, where
  `lattice` is the stored `FaceLattice`, one lattice per grid axis (`cube/axis`).
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
  - `pick` never changes `center` or the lattice for a patch; an off-lattice
    color is re-laid by `syncLattice`.
  - `reachEnd { after }` applies the edge rule after a pick, and returns the same
    object when the rule doesn't apply or the grid differs from `after`'s (a stale
    timer), compared by value since `view()` rebuilds the state.
  - Stored colors go through `roundHsl`.
- `move` is `axisStep` (in `axis.ts`) on each axis: the neighbouring patch, a
  one-step scroll past the window's edge, then the edge rule. Past the last S/L
  lattice value it tries the edge rule first, so an end that isn't a patch is
  still reachable from the keyboard. The reducer holds no
  lattice index math.
- `syncLattice(state)` re-lays any grid axis whose lattice doesn't hold the
  selection and re-centers it; on the others it stores the center the window
  actually uses (`windowCenter`), so a host value off the window doesn't make the
  next pick move the grid. `pick` ends with it, and `HslPicker`'s `view()` uses
  it for a parent's controlled `value` (spec §4.1).

## How to Verify

`vp test` passes, covering every action and each rule above, including:

- `zoom` at the limits returns the identical state object.
- Edge scrolls work in all four directions, including down from a window pinned at
  S/L 100 and left across hue 0.
- The edge rule fires for a `move` onto an edge patch and for `reachEnd`, and doesn't
  fire when the end is a whole step away.
- After any `pick` or `move`, the selection is on the stored lattice, and the
  stored center is the one the window uses.
- A host value on the lattice but off the window: the next pick and arrow keys keep
  that window.
- A stale `reachEnd` after a turn does nothing.
