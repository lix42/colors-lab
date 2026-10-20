# HSL Cube Picker — cube Progress Log

Execution log for the `cube` epic: what was done and how, key decisions, what
works, what doesn't. Task status lives in each task file's frontmatter; this file is
the narrative beside it. Append entries (`tasks log <id> "…"`); don't rewrite earlier ones.

## Epic summary

_Nothing yet._

## model

**Status:** not started
**Updated:** 2026-10-20

- 2026-10-19: filed. Goal: cube.ts, lattice.ts, face.ts: faces, turns, axisWindow, faceCells, peekStrips, ceilingStops
- 2026-10-20: plan revised: patch colors are computed in CSS (spec §3.5, §7.1). face.ts adds faceLayout (nine affine FaceParams + ring), patchColor, faceVars and patchBackground; peekStrips returns FaceParams; faceCells stays as the test reference and screenScheme input.

## reducer

**Status:** not started
**Updated:** 2026-10-19

- 2026-10-19: filed. Goal: PickerState, PickerAction, pickerReducer in state.ts

## gestures

**Status:** not started
**Updated:** 2026-10-19

- 2026-10-19: filed. Goal: pointerGesture, pinchProgress, velocity, wheel reducer in gestures.ts
