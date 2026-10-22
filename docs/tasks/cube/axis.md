---
title: Selection-anchored axis lattice
status: done
deps: [cube/model]
summary: layLattice/onLattice/axisWindow on a stored lattice; no approx mark; edge rule; lattice.ts renamed axis.ts
done: 2026-10-21
---

# Selection-anchored axis lattice

## Goal

Rework the grid's patch values so the selection is always a patch and neighbouring
patches are always one even step apart. This replaces the fixed values per zoom level
and the approximate (dashed) selection mark that `cube/model` built.

## Design

Spec [§3.4](../../hsl-picker/design-spec.md#34-grid-lattice-window-and-zoom), [§3.5](../../hsl-picker/design-spec.md#35-face-layout-peek-strips-and-ceiling-gradient); requirements _Zoom (fine-tuning)_.

- **Rename** `src/hsl/lattice.ts` (and its test) to `src/hsl/axis.ts`, since it no
  longer holds only `axisWindow`. It now holds the `AxisLattice` and `AxisWindow`
  types and the functions below. (**Proposed** name.)
- `AxisLattice = { origin, step }`: the values `origin + k · step`. S/L keep only
  the values inside 0–100.
- `layLattice(variable, n, zoom, selected, end?)`:
  - Hue: `{ origin: selected, step: d₀ }`.
  - S/L: `origin` is an end `E`, and `step = |selected − E| / ⌈|selected − E| / d₀⌉`,
    or `d₀` when the selection is at `E`.
  - An end closer than `d₀ / 2` is never `E`, and the edge rule ignores it.
  - Picking `E`: an end the laid window shows wins; otherwise the larger step; a tie
    goes to 0. `end` forces `E`, for the edge rule.
- `onLattice(variable, lattice, value)`: rounds the nearest lattice value the way
  `roundHsl` does and compares it for equality. This replaces `exact`.
- `axisWindow(variable, n, lattice, center, selected)`:
  - Returns `{ values, selectedIndex, step, first }`. The `exact` field is gone, and
    `nearest` is renamed `selectedIndex`.
  - It still centers on `center`, falls back to the selection, clamps S/L inside
    0–100 and wraps hue. Indices count from `origin`, and run negative for
    `origin = 100`.
- `edgeRelay`, the edge rule, which the reducer uses for `move` and `reachEnd`. It
  answers whether the selection is on an edge patch with an S/L end less than one step
  beyond (and at least `d₀ / 2` away), and returns the lattice laid on that end with
  `center` at the end.
- `laidWindow(variable, n, zoom, value)`: the window a turn or zoom shows, laid from
  `value` and centered on it.
- `face.ts`:
  - `FaceLattice = { x, y }`: one lattice per grid axis, since a lattice depends on the
    axis's patch count. `layFaceLattice(face, selection, zoom)` lays both.
  - `faceLayout(face, lattice, center, selection)` takes the stored lattice instead of
    `zoom`.
  - `SelectionMark` drops `kind`.
  - `peekStrips` lays the lattice a turn would lay, using `laidWindow` from the
    selection.
  - `patchColor`, `faceVars`, `patchBackground` and the CSS formula are unchanged.

## How to Verify

`vp check` and `vp test` pass, with the spec §10 `axis` and `face` cases rewritten
for the new design:

- S 64 at 1× with 5 columns gives 0, 21.3, 42.7, 64, 85.3.
- A selection on the nominal grid gives the nominal grid back.
- The end choice works, including a forced `end`.
- `onLattice` handles S 18.75 stored as 18.8.
- There is no drift at zoom 4, and hue wraps across 0/360.
- Other patch counts work (n = 3, 4 and 9).
- `edgeRelay` fires within one step of an end, and not when the end is a whole step
  away, a lattice value, or closer than `d₀ / 2` to the selection.
- `patchColor(faceLayout(…))` matches the reference grid for every face and zoom.
