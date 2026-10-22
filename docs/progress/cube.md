# HSL Cube Picker — cube Progress Log

Execution log for the `cube` epic: what was done and how, key decisions, what
works, what doesn't. Task status lives in each task file's frontmatter; this file is
the narrative beside it. Append entries (`tasks log <id> "…"`); don't rewrite earlier ones.

## Epic summary

- `src/hsl/` is the pure cube model — no Solid, no DOM. `cube.ts` has `Variable`, `Face`,
  `START_FACE`, `VARIABLES`, `turn`, `axisOf`; `lattice.ts` has `axisWindow`; `face.ts` has
  `faceLayout`, `patchColor`, `faceColors`, `peekStrips`, `ceilingStops`, `faceVars`,
  `patchBackground`, and the `GRID_COLUMNS`/`GRID_ROWS` constants.
- **Window anchoring is decided** (spec §3.4, §11): the grid window is centered on a stored
  `center`, not on the selection, so a pick never moves the grid. Centering on the selection was
  built and reversed — it pins the ring to the middle of the grid and slides the colors
  underneath. `axisWindow` and `faceLayout` take `center`; `peekStrips` and `ceilingStops` do not,
  because a turn re-centers. This is a **Deviation** from the requirements, recorded in the spec.
- A face is nine numbers, not 35 colors: `faceVars(params)` goes on the grid container and
  `patchBackground(col, row)` on each patch, and CSS computes the colors (spec §7.1). All nine
  properties must be present or the patch paints transparent. `faceColors` exists only as
  `screenScheme`'s input, never for rendering.
- `FaceParams` bases are deliberately unnormalized — a hue base can be negative or past 360.
  CSS and `roundHsl` both wrap them; don't normalize on the way to the DOM.
- The ring is `exact` only when both axes are; `exact` compares the lattice value rounded the way
  `roundHsl` rounds that channel, never a raw tolerance.

## model

**Status:** done
**Updated:** 2026-10-20

- 2026-10-19: filed. Goal: cube.ts, lattice.ts, face.ts: faces, turns, axisWindow, faceCells, peekStrips, ceilingStops
- 2026-10-20: plan revised: patch colors are computed in CSS (spec §3.5, §7.1). face.ts adds faceLayout (nine affine FaceParams + ring), patchColor, faceVars and patchBackground; peekStrips returns FaceParams; faceCells stays as the test reference and screenScheme input.
- 2026-10-20: plan revised after review: axisWindow also returns step and first (k₀·step, un-normalized) for faceLayout; y base is first + (rows − 1)·step; faceCells is replaced by faceColors(params) (patchColor at all 35 positions) and the independent reference grid moves into face.test.ts.
- 2026-10-20: plan revised after review: exact compares the lattice value rounded to 0.1 with the selection instead of a raw 0.05 tolerance, which misfires on values like 18.75 (stored 18.8); first + i·step matches values[i] only after rounding.
- 2026-10-20: Started. Decision: window anchoring settled as center-on-selection (user choice) instead of the Proposed stored center: axisWindow(variable, n, zoom, selected) and faceLayout(face, selection, zoom) take no center; spec §3.4–3.6, §5.3, §11 and cube/reducer updated to match. Known issue left for picker/gesture-wiring: zoomed windows move on pick, so dblclick's second click can land on a different patch.
- 2026-10-20: Decision reversed after review: the stored center stays (spec §3.4 Proposed → Decided). Center-on-selection was implemented first, but review showed it pins the ring to the grid centre and rotates a hue window on every pick at every zoom (1× included), breaking dblclick-to-zoom on the start face and the arrow-key focus/announcement rule in §4.4. axisWindow(variable, n, zoom, center, selected) and faceLayout(face, center, selection, zoom) are back; a selection counts as inside the window while its nearest lattice index is one of the window's (half-step margin at the edges), otherwise the window re-centers on it.
- 2026-10-20: Done. Landed src/hsl/cube.ts (Variable, Face, START_FACE, VARIABLES, turn, axisOf), lattice.ts (axisWindow) and face.ts (faceLayout, patchColor, faceColors, peekStrips, ceilingStops, faceVars, patchBackground), with a test file each.

  For dependents:
  - axisWindow(variable, n, zoom, center, selected) and faceLayout(face, center, selection, zoom) both take the stored window center; peekStrips(face, selection, zoom) and ceilingStops(face, selection, count?) do not, because a turn re-centers on the selection. cube/reducer must therefore keep `center` in PickerState and reset it on turn and zoom.
  - A selection counts as inside the window while its nearest lattice index is one of the window's, which leaves a half-step margin at each edge; outside that, the window re-centers on the selection, so `nearest` always indexes a value that is on screen.
  - `exact` compares the lattice value rounded the way roundHsl rounds that channel, never a raw tolerance.
  - Bases in FaceParams are deliberately unnormalized: a hue base on x can be negative and one on y can reach 360 or more. CSS and roundHsl both wrap them, so do not normalize them on the way to the DOM.
  - faceVars returns all nine custom properties and patchBackground(col, row) writes the column and row in as literals; all nine must be set on the container or the whole background is invalid and the patch goes transparent.
  - roundChannel moved into src/color/hsl.ts next to roundHsl; import it from there.

  Open for cube/reducer: spec §3.6 says turn and zoom reset `center`, and also that a no-op zoom returns the same state object, so a zoom clamped at 0 or 4 leaves `center` where it was. Pin which rule wins before implementing.

  Verified: vp check, vp test (1595), vp build. Mutation-checked the main invariants: flipping the y-axis sign, shifting a peek strip, dropping the re-center guard's negative branch and swapping two faceVars slots each fail tests.

## reducer

**Status:** not started
**Updated:** 2026-10-21

- 2026-10-19: filed. Goal: PickerState, PickerAction, pickerReducer in state.ts

## gestures

**Status:** not started
**Updated:** 2026-10-19

- 2026-10-19: filed. Goal: pointerGesture, pinchProgress, velocity, wheel reducer in gestures.ts

## axis

**Status:** not started
**Updated:** 2026-10-21

- 2026-10-21: filed. Goal: layLattice/onLattice/axisWindow on a stored lattice; no approx mark; edge rule; lattice.ts renamed axis.ts
