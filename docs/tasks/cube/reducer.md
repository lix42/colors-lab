---
title: Picker reducer
status: todo
deps: [cube/model]
summary: PickerState, PickerAction, pickerReducer in state.ts
---

# Picker reducer

## Goal

All picker behavior as one pure reducer, so every interaction is testable without
the DOM and transitions can compute their target before anything moves.

## Design

Spec [§3.6](../../hsl-picker/design-spec.md#36-picker-state). File `src/hsl/state.ts`.

- `PickerState { face, selection, center, zoom, expanded }`; `PickerAction`:
  `pick`, `setDepth`, `turn`, `zoom`, `toggleExpanded`, `move`.
- `initialPickerState(initial?)` — START_FACE, zoom 0, collapsed, default
  hsl(210 64% 56%).
- Rules: `turn` collapses the panel; `turn`/`zoom` reset `center` to the
  selection; `zoom` clamps 0–4 and a no-op returns the same object; `move` steps
  one patch and scrolls the window at the edge (Deviation from requirements), S/L
  stop at 0 and 100; `pick` never moves `center`; stored colors go through
  `roundHsl`.

## How to Verify

`vp test` passes, covering every action and each rule above, including
`zoom` at the limits returning the identical state object.
