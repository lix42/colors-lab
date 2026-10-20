---
title: PeekStrip and ZoomControl
status: todo
deps: [cube/model, cube/reducer, picker/theme]
summary: edge peek-strip buttons and the zoom -/level/+ control
---

# PeekStrip and ZoomControl

## Goal

The two small controls around the grid: edge strips that preview and trigger a
turn, and the zoom out / level / zoom in control.

## Design

Spec [§4.5](../../hsl-picker/design-spec.md#45-peekstrip), [§4.6](../../hsl-picker/design-spec.md#46-zoom-control). Files
`src/picker/PeekStrip.tsx`, `ZoomControl.tsx`.

- `PeekStrip`: `<button>` labelled with the turn ("Turn sideways: put Hue on the
  slider"); colors from `peekStrips` as flex children; dispatches `turn` with its
  direction; 14 px thick, `::after` extends the hit area 10 px; `cva` orientation
  variant.
- `ZoomControl`: "Zoom out" / "Zoom in" buttons, disabled at 0 and 4, around the
  level text (`1×`…`16×`); dispatches `zoom`.

## How to Verify

`vp test`: a strip click dispatches the right `turn`; zoom buttons dispatch and
disable at the limits. Stories for all four strip edges and the zoom levels; a11y
addon clean.
