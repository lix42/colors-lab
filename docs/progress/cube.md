# HSL Cube Picker — cube Progress Log

Execution log for the `cube` epic: what was done and how, key decisions, what
works, what doesn't. Task status lives in each task file's frontmatter; this file is
the narrative beside it. Append entries (`tasks log <id> "…"`); don't rewrite earlier ones.

## Epic summary

_Nothing yet._

## model

**Status:** in progress
**Updated:** 2026-10-20

- 2026-10-19: filed. Goal: cube.ts, lattice.ts, face.ts: faces, turns, axisWindow, faceCells, peekStrips, ceilingStops
- 2026-10-20: plan revised: patch colors are computed in CSS (spec §3.5, §7.1). face.ts adds faceLayout (nine affine FaceParams + ring), patchColor, faceVars and patchBackground; peekStrips returns FaceParams; faceCells stays as the test reference and screenScheme input.
- 2026-10-20: plan revised after review: axisWindow also returns step and first (k₀·step, un-normalized) for faceLayout; y base is first + (rows − 1)·step; faceCells is replaced by faceColors(params) (patchColor at all 35 positions) and the independent reference grid moves into face.test.ts.
- 2026-10-20: plan revised after review: exact compares the lattice value rounded to 0.1 with the selection instead of a raw 0.05 tolerance, which misfires on values like 18.75 (stored 18.8); first + i·step matches values[i] only after rounding.
- 2026-10-20: Started. Decision: window anchoring settled as center-on-selection (user choice) instead of the Proposed stored center: axisWindow(variable, n, zoom, selected) and faceLayout(face, selection, zoom) take no center; spec §3.4–3.6, §5.3, §11 and cube/reducer updated to match. Known issue left for picker/gesture-wiring: zoomed windows move on pick, so dblclick's second click can land on a different patch.
- 2026-10-20: Decision reversed after review: the stored center stays (spec §3.4 Proposed → Decided). Center-on-selection was implemented first, but review showed it pins the ring to the grid centre and rotates a hue window on every pick at every zoom (1× included), breaking dblclick-to-zoom on the start face and the arrow-key focus/announcement rule in §4.4. axisWindow(variable, n, zoom, center, selected) and faceLayout(face, center, selection, zoom) are back; a selection counts as inside the window while its nearest lattice index is one of the window's (half-step margin at the edges), otherwise the window re-centers on it.

## reducer

**Status:** not started
**Updated:** 2026-10-19

- 2026-10-19: filed. Goal: PickerState, PickerAction, pickerReducer in state.ts

## gestures

**Status:** not started
**Updated:** 2026-10-19

- 2026-10-19: filed. Goal: pointerGesture, pinchProgress, velocity, wheel reducer in gestures.ts
