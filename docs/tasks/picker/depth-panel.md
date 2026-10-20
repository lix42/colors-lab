---
title: Ceiling, DepthPanel and DepthSlider
status: todo
deps: [cube/model, cube/reducer, picker/theme]
summary: collapsed ceiling button, expanded panel with vertical depth slider, focus handling
---

# Ceiling, DepthPanel and DepthSlider

## Goal

The third variable's control: a tilted gradient "ceiling" that opens a panel with a
swatch and a vertical slider for exact depth values.

## Design

Spec [§4.3](../../hsl-picker/design-spec.md#43-ceiling-and-expanded-slider-panel). Files `src/picker/Ceiling.tsx`,
`DepthPanel.tsx`.

- `Ceiling`: `<button aria-expanded>` ("Lightness 56%. Open slider"); a span
  tilted with CSS 3D; gradient and marker via `--ceiling-gradient` /
  `--marker-top` from `ceilingStops`.
- `DepthPanel`: label (depth name and value), Done, swatch (`toCss`, `toHex`,
  `contrastInk` ink), `DepthSlider`; `sva` slot recipe.
- `DepthSlider`: native vertical range input, `step=0.1`, max 100 (hue 359.9),
  `aria-valuetext`, `onInput` → `setDepth` with `Number(e.currentTarget.value)`;
  keydown steps 1 (10 with Shift), Page Up/Down 10. The track is styled as the
  depth gradient via `--track-gradient` (from `ceilingStops`), not the browser
  default.
- Focus moves to the slider on open and back to the ceiling on close.
- Replaces `src/Slider.tsx`'s role; carry its `Number(...)` regression test over.

## How to Verify

`vp test`: `aria-expanded` toggles; focus moves into the panel and back; the
slider reports numbers, and the custom key steps work. Stories: ceiling collapsed
and expanded with the gradient track, hue depth; a11y addon clean.
