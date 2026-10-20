---
title: FaceGrid
status: todo
deps: [cube/model, cube/reducer, picker/theme]
summary: "5 x 7 patch radiogroup: roving focus, keyboard, ring variants, stories"
---

# FaceGrid

## Goal

The 5 × 7 patch grid as an accessible radiogroup that picks colors by pointer and
keyboard.

## Design

Spec [§4.4](../../hsl-picker/design-spec.md#44-facegrid-and-patches), [§5.5](../../hsl-picker/design-spec.md#55-keyboard), [§8](../../hsl-picker/design-spec.md#8-accessibility).
File `src/picker/FaceGrid.tsx`.

- `role="radiogroup"` with an aria-label ("Hue by Saturation at Lightness 56%")
  and a description listing the keys; each patch a `<button role="radio">`
  labelled `toCss(color)`, `aria-checked` only on an `exact` ring.
- Roving tabindex on the ringed patch; arrows dispatch `move` then `.focus()` the
  new ringed patch; Shift + Arrow `turn`; `+`/`-` `zoom`.
- After a turn or zoom moves the ring, focus follows it: if focus was in the grid,
  `.focus()` the new ringed patch. `<Index>` keeps the old button, so without
  this focus stays on a patch that is no longer selected.
- `<Index>` over the 35 cells so buttons are never recreated. 48 px patches, 4 px
  gap; `cva` ring variant `none | exact | approx` (solid vs dashed); patch color
  via `--patch-color`.

## How to Verify

`vp test`: one Tab stop; arrows move `aria-checked` and `document.activeElement`;
an approx ring checks no radio and the description names the selection; Shift +
Arrow dispatches a turn, and afterwards `document.activeElement` is the new ringed
patch. Stories: all six faces, each zoom level, S = 0 and
S = 100, an approx ring; a11y addon clean.
