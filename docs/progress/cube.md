# HSL Cube Picker — cube Progress Log

Execution log for the `cube` epic: what was done and how, key decisions, what
works, what doesn't. Task status lives in each task file's frontmatter; this file is
the narrative beside it. Append entries (`tasks log <id> "…"`); don't rewrite earlier ones.

## Epic summary

- `src/hsl/` is the pure cube model — no Solid, no DOM. `cube.ts` has `Variable`, `Face`,
  `START_FACE`, `VARIABLES`, `turn`, `axisOf`; `axis.ts` (formerly `lattice.ts`) has `layLattice`,
  `onLattice`, `axisWindow`, `laidWindow`, `edgeRelay`, `windowCenter`, `axisStep`; `face.ts` has `FaceLattice`,
  `layFaceLattice`, `faceLayout`, `patchColor`, `faceColors`, `peekStrips`, `ceilingStops`,
  `faceVars`, `patchBackground`, and the `GRID_COLUMNS`/`GRID_ROWS`/`GRID_SIZE` constants; `state.ts` has `PickerState`,
  `PickerAction`, `pickerReducer`, `initialPickerState`, `syncLattice`.
- **The selection is always a patch** (spec §3.4, `cube/axis`): each grid axis's lattice is laid
  through the selection (S/L also through one range end) in even steps, and stored as state per
  axis (`FaceLattice { x, y }`). It is re-laid on open, turn, zoom, a host value that isn't on it,
  and by the edge rule (`edgeRelay`); never on a pick or arrow move.
- **Window anchoring is decided** (spec §3.4, §11): the grid window is centered on a stored
  `center`, not on the selection, so a pick never moves the grid. Centering on the selection was
  built and reversed — it pins the selection mark to the middle of the grid and slides the colors
  underneath. `axisWindow` and `faceLayout` take `center`; `peekStrips` and `ceilingStops` do not,
  because a turn re-lays and re-centers. This is a **Deviation** from the requirements, recorded in the spec.
- A face is nine numbers, not 35 colors: `faceVars(params)` goes on the grid container and
  `patchBackground(col, row)` on each patch, and CSS computes the colors (spec §7.1). All nine
  properties must be present or the patch paints transparent. `faceColors` exists only as
  `screenScheme`'s input, never for rendering.
- `FaceParams` bases are deliberately unnormalized — a hue base can be negative or past 360.
  CSS and `roundHsl` both wrap them; don't normalize on the way to the DOM.
- **The reducer contract for picker tasks** (`cube/reducer`): `HslPicker` builds
  `view = () => syncLattice({ ...state(), selection: selection() })` and dispatches against it;
  `syncLattice` also stores the window's actual center, so a host value never makes the next pick
  move the grid. FaceGrid's edge-rule timer dispatches `reachEnd { after }` with the state the
  pick left; it is compared by value (`view()` is a new object each read), so a turn, zoom, move
  or another pick cancels it and a depth change doesn't. Actions that change nothing return the
  same object.
- The selection mark has no approximate state. Whether a stored value is on a lattice is
  `onLattice`: the nearest in-range lattice value rounded the way `roundHsl` rounds that channel,
  never a raw tolerance.

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

**Status:** done
**Updated:** 2026-10-22

- 2026-10-19: filed. Goal: PickerState, PickerAction, pickerReducer in state.ts
- 2026-10-20: Started. Pinned the open rule from cube/model with the user: a zoom clamped at 0 or 4 returns the identical state object and leaves center alone; center resets only when the zoom actually changes (How to Verify's identity rule wins over §3.6's "zoom resets center").

  move's edge scroll: the new center is not old center + step — near the S/L lattice ends the window clamp pins k0, the shifted center re-derives the same window, and the stepped selection falls out and triggers a re-center lurch. Instead the center keeps the selection on the same edge patch: center = (k − d·⌊n/2⌋)·step for the new lattice index k. Unclamped, this is exactly old-center-index + d; clamped at 0/100, the window still moves one step. The moved selection is always a lattice value, so the ring after a move is exact.

  Verified: vp test (1626), vp check.

- 2026-10-21: Reworked on top of cube/axis (#15). The 2026-10-20 draft's edge-scroll formula and its claim that a moved selection is always exact are superseded: the selection is now always a patch by construction. PickerState gains lattice: FaceLattice, laid with layFaceLattice on open, turn and zoom. move is axisStep (new in axis.ts: neighbour, one-step scroll at the edge, then edgeRelay), so state.ts has no lattice index math. reachEnd applies edgeRelay to both axes and returns the same object when neither applies. syncLattice re-lays an axis whose lattice doesn't hold the selection; pick ends with it, and HslPicker's view() will use it for a controlled value, which also fixes the stale-center jump the first review found. move keeps lattice and center as the same objects unless they change. Zoom clamped at 0/4 still returns the same object. Tests: every action, scrolls in all four directions (down from S 100, left across hue 0), the edge rule firing and not, and an 8-seed × 400-action invariant sweep (selection rounded, on both lattices, and the marked patch's color). Verified: vp check, vp test (2268).
- 2026-10-22: Review fixes: syncLattice stores the window's actual center (new windowCenter in axis.ts), so a host value on the lattice but off the window no longer makes the next pick or arrow scroll the grid; axisStep returns the center it used, and past the last S/L value tries the edge rule so an end that isn't a patch is reachable by keyboard; reachEnd carries after: PickerState and ignores a stale timer; withAxis helper, GRID_SIZE in face.ts. Sweep now covers off-lattice picks, host values and stale reachEnd, and asserts the stored center. Declined: default case in the reducer switch, deduping placeWindow calls.
- 2026-10-22: Done. PickerState stores lattice: FaceLattice, laid on open/turn/zoom. move = axisStep per axis (neighbour patch, one-step scroll, edge rule; past the last S/L value the edge rule steps onto an end that isn't a patch). pick ends with syncLattice, which re-lays an off-lattice axis and otherwise stores windowCenter, so the grid never jumps. reachEnd {after} applies the edge rule only when sameGrid(state, after), a value comparison because view() rebuilds the state on every read; a depth change doesn't cancel it, a turn/zoom/move/other pick does. Verified: vp check, vp test 2282 (8x400 invariant sweep), vp build; review-fix loop converged after 2 re-reviews. For dependents: picker/compose builds view() with syncLattice and dispatches against it; picker/face-grid's edge timer passes the state the pick left as after.

## gestures

**Status:** not started
**Updated:** 2026-10-19

- 2026-10-19: filed. Goal: pointerGesture, pinchProgress, velocity, wheel reducer in gestures.ts

## axis

**Status:** done
**Updated:** 2026-10-21

- 2026-10-21: filed. Goal: layLattice/onLattice/axisWindow on a stored lattice; no approx mark; edge rule; lattice.ts renamed axis.ts
- 2026-10-21: Implemented. src/hsl/lattice.ts → axis.ts: layLattice (hue through the selection; S/L through the selection and one end, step ≤ d₀; reachable end first, then larger step, tie to 0; forced end), onLattice (rounded nearest lattice value), axisWindow on a stored lattice (indices from origin; S/L index range [ceil(−origin/step), floor((100 − origin)/step)] with a 1e-9 epsilon, since 50 / (100/6) is 2.9999999999999996), and edgeRelay (the edge rule; null for hue, middle patches, an end that is already a patch, or a whole step left). face.ts: FaceLattice { x, y } stored per axis (agreed with the user: a lattice depends on the axis's patch count, and turns re-lay it anyway), layFaceLattice, faceLayout(face, lattice, center, selection), SelectionMark without kind; peekStrips lays its own lattices. Spec example corrected: the stored 85.3 gives step 14.7 exactly, so the edge rule re-lays to 41.2, 55.9, 70.6, 85.3, 100. Verified: vp check, vp test (2215).
- 2026-10-21: Code review fixes: one latticeIndex helper (in-range S/L indices) behind onLattice, axisWindow and edgeRelay, fixing onLattice accepting an off-lattice 0/100 and edgeRelay firing from the rounded selection when the end is a lattice value one step away. The end choice now asks whether the laid, centered window shows the end (distance alone let an off-screen end win). With the user: an end closer than d₀/2 is never the anchor and the edge rule ignores it (option A), since a lattice through both has step ≤ their distance (S 99.9 → 0.1); it is reached by zooming in. nearest renamed selectedIndex; laidWindow exported. Verified: vp check, vp test (2221).
- 2026-10-21: Done. Landed: src/hsl/lattice.ts → axis.ts with layLattice (hue through the selection; S/L through the selection and one end, step ≤ d₀; an end closer than d₀/2 never anchors; an end the laid window shows wins, else the larger step, tie to 0; forced end), onLattice and axisWindow on one latticeIndex helper, laidWindow, and edgeRelay (edge patch is the last in-range lattice value, the end isn't a patch, and the end is ≥ d₀/2 from the stored selection). face.ts: FaceLattice {x, y}, layFaceLattice, faceLayout(face, lattice, center, selection), SelectionMark without kind; AxisWindow.nearest is now selectedIndex. Verified: vp check, vp test (2222), vp build; review-fix-loop converged. For cube/reducer: store FaceLattice and lay it with layFaceLattice on open, turn and zoom; move steps selectedIndex ± 1 and calls edgeRelay; reachEnd calls edgeRelay after the double-click interval; the draft's ./lattice import becomes ./axis.
