---
title: PickerFace and HslPicker composition
status: todo
deps: [picker/face-grid, picker/depth-panel, picker/peek-zoom]
summary: "public HslPicker: controlled/uncontrolled, confirm/cancel, live region"
---

# PickerFace and HslPicker composition

## Goal

The public `HslPicker` component, usable without animation or gestures: state,
controlled and uncontrolled modes, confirm and cancel, and the accessible face
layout.

## Design

Spec [§4.1–4.2](../../hsl-picker/design-spec.md#41-hslpicker-public-api-confirm-callback), [§8](../../hsl-picker/design-spec.md#8-accessibility).
Files `src/picker/HslPicker.tsx`, `PickerFace.tsx`.

- Props `{ value?, initialColor?, onChange?, onConfirm, onCancel }`. A single
  `view()` (state with the displayed selection) feeds dispatch and the memoized
  `faceLayout` / `peekStrips` / `ceilingStops`; the grid and strips get
  `FaceParams`, never color lists (spec §7.1). In controlled mode a pick only
  calls `onChange`.
- `PickerFace` lays out depth label, ceiling, grid region (axis labels, four
  strips, grid), footer (zoom, hints); `DepthPanel` is the grid region's sibling,
  and the grid region is `inert` while expanded. Source order follows the tab
  order in §8: close → ceiling → top strip → left strip → grid → right strip →
  bottom strip → zoom out → zoom in → confirm.
- Header (close, title) and confirm button (selection background, `toCss` label,
  `contrastInk` ink); `aria-live` announcement after a turn; scheme and tint from
  `screenScheme` (fed by `faceCells`, recomputed on commit) applied to the root. Scheme changes cross-fade
  `background-color` and `color` over 300 ms, instantly under `_motionReduce`.
- `turn`, `zoom` and `toggleExpanded` dispatch directly here;
  `picker/transitions` later routes them through the transition controller.

## How to Verify

`vp test`: confirm returns the rounded selection; cancel calls `onCancel`;
controlled mode — a pick calls `onChange` but the ring moves only when `value`
changes, and a new `value` moves it; tabbing from the close button visits the
controls in the §8 order. Stories: `PickerFace` composed, `HslPicker`
interactive (uncontrolled and controlled); a11y addon clean.
