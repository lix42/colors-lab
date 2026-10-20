---
title: FaceGrid
status: todo
deps: [cube/model, cube/reducer, picker/theme]
summary: "5 x 7 patch radiogroup: colors computed in CSS, roving focus, keyboard, ring variants, ring-only labels, stories"
---

# FaceGrid

## Goal

The 5 × 7 patch grid as an accessible radiogroup that picks colors by pointer and
keyboard.

## Design

Spec [§4.4](../../hsl-picker/design-spec.md#44-facegrid-and-patches), [§5.5](../../hsl-picker/design-spec.md#55-keyboard), [§7.1](../../hsl-picker/design-spec.md#71-patch-colors-in-css), [§8](../../hsl-picker/design-spec.md#8-accessibility).
File `src/picker/FaceGrid.tsx`.

- Props: `params: FaceParams`, `ring: Ring`, the group's label and description,
  and `dispatch`. The grid never receives a list of colors.
- `role="radiogroup"` with an aria-label ("Hue by Saturation at Lightness 56%")
  and a description listing the keys; each patch a `<button role="radio">`,
  `aria-checked` only on an `exact` ring.
- **Colors in CSS, no per-patch updates**: the container sets `faceVars(params)`
  on its `style`; each patch sets `style={{ background: patchBackground(col, row) }}`,
  which reads no signal, so Solid writes it once at creation. Inline `style`, not
  `css()`: Panda can't extract strings built in a loop.
- **Labels** (Deviation, spec §4.4): the ringed patch is labelled
  `toCss(patchColor(params, col, row))`; every other patch keeps a fixed
  positional label counted from 1 (`Column ${col + 1}, row ${row + 1}`).
- One `createSelector` over the ringed index drives the ring variant,
  `aria-checked`, `tabIndex` and which label a patch shows, so a ring move re-runs
  only the two patches it leaves and enters. The ringed patch's label also reads
  `params`, so it follows a depth step; nothing else on a patch is reactive.
- A click dispatches `pick` with `patchColor(props.params, col, row)`, computing only
  that patch's color.
- Roving tabindex on the ringed patch; arrows dispatch `move` then `.focus()` the
  new ringed patch; Shift + Arrow `turn`; `+`/`-` `zoom`.
- After a turn or zoom moves the ring, focus follows it: if focus was in the grid,
  `.focus()` the new ringed patch. `<Index>` keeps the old button, so without
  this focus stays on a patch that is no longer selected.
- `<Index>` over the 35 positions so buttons are never recreated; each button's
  `col` and `row` are fixed by its index. 48 px patches, 4 px gap; `cva` ring
  variant `none | exact | approx` (solid vs dashed).

## How to Verify

`vp test`: one Tab stop; arrows move `aria-checked` and `document.activeElement`;
an approx ring checks no radio and the description names the selection; Shift +
Arrow dispatches a turn, and afterwards `document.activeElement` is the new ringed
patch; clicking a patch picks `patchColor` of its position; only the ringed patch
has an `hsl()` label. A `MutationObserver` on the patches sees only the ringed
patch's `aria-label` change on a depth change, and changes on only the old and new ringed patch on a ring move.
Stories: all six faces, each zoom level, S = 0 and S = 100, an approx ring; a play
function compares a few patches' computed `background-color` against
`toHex(patchColor(…))`, within one 8-bit step per channel (jsdom can't evaluate
`var()`/`calc()`); a11y addon clean.
