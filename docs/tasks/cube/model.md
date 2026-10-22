---
title: Cube, lattice and face data
status: done
deps: [color/hsl]
summary: "cube.ts, lattice.ts, face.ts: faces, turns, axisWindow, faceLayout, patchColor, faceColors, peekStrips, ceilingStops, CSS formula strings"
done: "2026-10-20 #13"
---

# Cube, lattice and face data

## Goal

The pure model of what one face of the cube shows: which variables sit on the
slider and the axes, the patch values at each zoom level, and the derived face
layout (nine numbers CSS turns into the patch colors), peek strips and ceiling
gradient.

## Design

Spec [§3.2–3.5](../../hsl-picker/design-spec.md#32-cube-state), [§7.1](../../hsl-picker/design-spec.md#71-patch-colors-in-css). Files `src/hsl/cube.ts`, `lattice.ts`, `face.ts`.

- `cube.ts`: `Variable`, `Face`, `START_FACE`, `VARIABLES`, `turn(face, axis)`,
  `axisOf(direction)`.
- `lattice.ts`: `axisWindow(variable, n, zoom, center, selected)` on a fixed lattice
  per variable and zoom (S/L clamp inside 0–100, hue wraps); values computed as
  `k · step`, never accumulated; returns `step` and `first` (`k₀ · step`, before
  `normalizeHue`) alongside `values`, `nearest` and `exact`. When `selected` falls outside the window from
  `center`, the window centers on `selected`; it counts as inside while its nearest
  lattice index is one of the window's, leaving a half-step margin at each edge. `exact` compares the rounded
  lattice value with `selected` (a raw 0.05 tolerance misfires on 18.75 → 18.8).
- `face.ts`:
  - `faceLayout` returns `FaceParams`, an `Affine` `{ base, perCol, perRow }` per
    variable (x grows with the column, y shrinks with the row so the top row is
    the y max, depth is constant), plus the `SelectionMark` (`col`, `row`,
    `exact`/`approx`). Built from `axisWindow`'s `first` and `step`; the y base is
    `first + (GRID_ROWS − 1) · step`. Bases are never normalized: a hue base on x
    can be negative, one on y can reach 360 or more.
  - `patchColor(params, col, row)`: one patch's color, `roundHsl` of the three
    affine values.
  - `faceColors(params)`: `patchColor` at all 35 positions, top row first;
    `screenScheme`'s input, not used for rendering. The independent reference
    grid (built from `axisWindow` directly) lives in `face.test.ts`.
  - `peekStrips`: one `FaceParams` per strip (left/right indexed by row,
    top/bottom by column), always from the re-centered windows, matching the
    face a turn shows.
  - `ceilingStops` (max first; hue 359.9 → 0).
  - CSS strings: `faceVars(params)` returns all nine custom properties
    (`--h-base`, `--h-col`, `--h-row`, and the same for `s` and `l`);
    `patchBackground(col, row)` returns the `hsl(calc(…))` formula with `col`
    and `row` written in as literals.

Window anchoring is decided here (spec §11): keep the stored `center`. A window
that centers on the selection instead pins the selection mark to the middle of the grid and
slides the colors under the pointer, so `center` stays.

## How to Verify

`vp test` passes with tests per module: the six-face loop and `turn` twice is
identity; S/L windows at zoom 0 are exactly `[0, 25, 50, 75, 100]` (and the 7-value
one); windows at the ends stay in 0–100; hue wraps at 350° 1×; no drift at zoom 4;
`exact` vs nearest after zooming out from a fine pick; an exact pick of S 18.75
at zoom 2 (stored 18.8) is `exact`; `normalizeHue(first + i · step)` matches
`values[i]` after rounding; out-of-window `selected`
re-centers; selection mark placement; peek strips match the turned face's edges.
`patchColor(faceLayout(…).params, col, row)` equals the reference grid at every cell
for all six faces, every zoom level, selections at S/L 0 and 100 and hue windows
across 0/360; each strip's `FaceParams` matches its `axisWindow` definition the
same way. `faceVars` returns all nine properties; `patchBackground(2, 3)` matches
a snapshot.
