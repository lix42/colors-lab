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

- `PickerState { face, selection, zoom, expanded }` (no window center: the
  window follows the selection, decided in `cube/model`); `PickerAction`:
  `pick`, `setDepth`, `turn`, `zoom`, `toggleExpanded`, `move`.
- `initialPickerState(initial?)` — START_FACE, zoom 0, collapsed, default
  hsl(210 64% 56%).
- Rules: `turn` collapses the panel; `zoom` clamps 0–4 and a no-op returns the
  same object; `move` steps one lattice value (the window follows, so repeated
  moves keep going), S/L stop at 0 and 100, hue wraps; stored colors go through
  `roundHsl`.

## How to Verify

`vp test` passes, covering every action and each rule above, including
`zoom` at the limits returning the identical state object.
