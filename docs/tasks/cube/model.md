---
title: Cube, lattice and face data
status: todo
deps: [color/hsl]
summary: "cube.ts, lattice.ts, face.ts: faces, turns, axisWindow, faceCells, peekStrips, ceilingStops"
---

# Cube, lattice and face data

## Goal

The pure model of what one face of the cube shows: which variables sit on the
slider and the axes, the patch values at each zoom level, and the derived cells,
peek strips and ceiling gradient.

## Design

Spec [§3.2–3.5](../../hsl-picker/design-spec.md#32-cube-state). Files `src/hsl/cube.ts`, `lattice.ts`, `face.ts`.

- `cube.ts`: `Variable`, `Face`, `START_FACE`, `VARIABLES`, `turn(face, axis)`,
  `axisOf(direction)`.
- `lattice.ts`: `axisWindow(variable, n, zoom, center, selected)` on a fixed lattice
  per variable and zoom (S/L clamp inside 0–100, hue wraps); values computed as
  `k · step`, never accumulated. When `selected` falls outside the window from
  `center`, the window centers on `selected`. `exact` uses a 0.05 tolerance.
- `face.ts`: `faceCells` (5 × 7, top row = y max, `exact`/`approx` ring),
  `peekStrips` (always the re-centered windows, matching the face a turn shows),
  `ceilingStops` (max first; hue 359.9 → 0).

Window anchoring on a stored `center` is **Proposed** (spec §11): decide here,
before `cube/reducer` builds on it.

## How to Verify

`vp test` passes with tests per module: the six-face loop and `turn` twice is
identity; S/L windows at zoom 0 are exactly `[0, 25, 50, 75, 100]` (and the 7-value
one); windows at the ends stay in 0–100; hue wraps at 350° 1×; no drift at zoom 4;
`exact` vs nearest after zooming out from a fine pick; out-of-window `selected`
re-centers; ring placement; peek strips match the turned face's edges.
