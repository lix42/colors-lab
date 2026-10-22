---
title: FaceGrid
status: todo
deps: [cube/model, cube/reducer, picker/theme]
summary: "patch radiogroup (5 x 7 to start): colors computed in CSS, roving focus, keyboard, selection-mark variants, labels only on the marked patch, stories"
---

# FaceGrid

## Goal

The 5 × 7 patch grid as an accessible radiogroup that picks colors by pointer and
keyboard.

## Design

Spec [§4.4](../../hsl-picker/design-spec.md#44-facegrid-and-patches), [§5.5](../../hsl-picker/design-spec.md#55-keyboard), [§7.1](../../hsl-picker/design-spec.md#71-patch-colors-in-css), [§8](../../hsl-picker/design-spec.md#8-accessibility).
File `src/picker/FaceGrid.tsx`.

- Props: `params: FaceParams`, `mark: SelectionMark`, the group's label and description,
  and `dispatch`. The grid never receives a list of colors.
- `role="radiogroup"` with an aria-label ("Hue by Saturation at Lightness 56%")
  and a description listing the keys; each patch a `<button role="radio">`,
  `aria-checked` on the marked patch. The selection is always a patch, so exactly
  one radio is always checked.
- **Colors in CSS, no per-patch updates**: the container sets `faceVars(params)`
  on its `style`; each patch sets `style={{ background: patchBackground(col, row) }}`,
  which reads no signal, so Solid writes it once at creation. Inline `style`, not
  `css()`: Panda can't extract strings built in a loop.
- **Labels** (Deviation, spec §4.4): the marked patch is labelled
  `toCss(patchColor(params, col, row))`; every other patch keeps a fixed
  positional label counted from 1 (`Column ${col + 1}, row ${row + 1}`).
- One `createSelector` over the marked index drives the mark variant,
  `aria-checked`, `tabIndex` and which label a patch shows, so a mark move re-runs
  only the two patches it leaves and enters. The marked patch's label also reads
  `params`, so it follows a depth step; nothing else on a patch is reactive.
- A click dispatches `pick` with `patchColor(props.params, col, row)`, computing only
  that patch's color. A pick on an edge patch also starts the edge-rule timer: after
  the double-click interval (Proposed: 300 ms) it dispatches `reachEnd`, unless a
  double-click arrived first (spec §3.4, §5.3).
- Roving tabindex on the marked patch; arrows dispatch `move` then `.focus()` the
  new marked patch; Shift + Arrow `turn`; `+`/`-` `zoom`.
- After a turn or zoom moves the mark, focus follows it: if focus was in the grid,
  `.focus()` the new marked patch. `<Index>` keeps the old button, so without
  this focus stays on a patch that is no longer selected.
- `<Index>` over the `GRID_COLUMNS × GRID_ROWS` positions so buttons are never
  recreated; each button's `col` and `row` are fixed by its index. 48 px patches,
  4 px gap; `cva` variant `marked: true | false`, drawn as a solid outline.

## How to Verify

`vp test`: one Tab stop; arrows move `aria-checked` and `document.activeElement`;
exactly one radio is always checked; an edge pick dispatches `reachEnd` after the
double-click interval, and a double-click cancels it; Shift +
Arrow dispatches a turn, and afterwards `document.activeElement` is the new marked
patch; clicking a patch picks `patchColor` of its position; only the marked patch
has an `hsl()` label. A `MutationObserver` on the patches sees only the marked
patch's `aria-label` change on a depth change, and changes on only the old and new marked patch on a mark move.
Stories: all six faces, each zoom level, S = 0 and S = 100, an S/L grid re-laid on
100 after an edge pick; a play
function compares a few patches' computed `background-color` against
`toHex(patchColor(…))`, within one 8-bit step per channel (jsdom can't evaluate
`var()`/`calc()`); a11y addon clean.
