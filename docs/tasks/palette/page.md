---
title: Palette page and persistence
status: todo
deps: [picker/compose]
summary: PalettePage, storage.ts, replace App.tsx, remove Slider.tsx
---

# Palette page and persistence

## Goal

The demo app: a palette page that opens the picker, keeps confirmed colors across
reloads, and replaces the old three-slider demo.

## Design

Spec [§4.7](../../hsl-picker/design-spec.md#47-palette-demo-page), [§9](../../hsl-picker/design-spec.md#9-state-and-persistence),
[§2 Existing code](../../hsl-picker/design-spec.md#existing-code).

- `src/palette/PalettePage.tsx`: `palette` and `pickerOpen` signals; card grid
  (swatch, `toCss`, `toHex`); floating + button; full-screen `HslPicker` with
  `initialColor` = last entry; confirm appends and closes, cancel closes. Phone
  layout centered at `max-width: 430px` on desktop (Proposed).
- `src/palette/storage.ts`: pure `parsePalette` / `serializePalette` (validate,
  `roundHsl`, drop invalid, `[]` on bad input) and thin `loadPalette` /
  `savePalette` over `localStorage` key `colors-lab:palette:v1`, falling back to
  memory on storage errors.
- `src/App.tsx` renders `PalettePage`; remove `src/Slider.tsx`, its story and
  tests.

## How to Verify

`vp check`, `vp test`, `vp build` pass. `storage.test.ts` covers valid, partial,
malformed and null input and round-trips. Stories: `PalettePage` empty and
populated. Manual: add colors, reload, they persist.
