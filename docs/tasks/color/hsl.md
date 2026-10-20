---
title: HSL color core
status: done
deps: []
summary: Hsl type, normalize/round, toCss, toHex, contrastInk in src/color/
done: 2026-10-19
---

# HSL color core

## Goal

The `Hsl` type and its conversions, the base every other module builds on. One place
rounds values, so stored, displayed and returned colors always agree.

## Design

Spec [§3.1](../../hsl-picker/design-spec.md#31-color-types-and-conversions). File `src/color/hsl.ts`; other color spaces will join it under `src/color/`.

- `Hsl = { h, s, l }`: h in [0, 360), s and l in [0, 100].
- `normalizeHue`, `roundHsl` (0.1 precision, then normalize so 359.96 → 0),
  `toCss` (`"hsl(210 64% 56%)"`), `toHex` (uppercase).
- `relativeLuminance(c)` (WCAG, sRGB linearized), exported for `picker/theme`.
- `INK_ON_COLOR = { dark: "#1A1A19", light: "#FFFFFF" }`, the single source for
  the ink colors; `panda.config.ts` imports it for the `picker.inkOnColor` tokens.
- `contrastInk(c): "dark" | "light"` picks whichever `INK_ON_COLOR` entry has the
  higher contrast ratio. Returns a name, not a color.

## How to Verify

`vp check` and `vp test` pass, with `src/color/hsl.test.ts` covering: rounding at
0.05 boundaries; `359.96 → 0`; negative and >360 hues normalize; hex for known
colors; `relativeLuminance` of black, white and mid gray; `contrastInk` against
known WCAG pairs.
