---
title: Theme, schemes and fonts
status: todo
deps: [color/hsl]
summary: Panda light/dark schemes, surface texture, fonts, theme.ts (screenScheme, tintedSurface)
---

# Theme, schemes and fonts

## Goal

The picker's visual foundation: light and dark schemes that adapt to the colors on
screen, a hue-tinted surface with a dot texture, ink that stays readable on any
patch, and self-hosted fonts.

## Design

Spec [§7](../../hsl-picker/design-spec.md#7-styling).

- `panda.config.ts`: `picker.*` semantic tokens for both schemes (table in §7),
  including scheme-independent `picker.inkOnColor.dark`/`.light` built from
  `INK_ON_COLOR` in `src/color/hsl.ts` (not repeated as literals); a custom
  condition switching on `data-scheme` on the picker root; `body`/`mono` font
  tokens. Run `vp exec panda codegen` after.
- `src/hsl/theme.ts`: `screenScheme(colors, previous)` — the grid's colors come
  from `faceCells` (patches are painted by CSS, so there is no color list in the
  DOM); mean CIE L* (from
  `relativeLuminance` in `src/color/hsl.ts`) above 55 →
  dark, below 45 → light, else previous; plus a tint from the saturation-weighted
  circular hue mean, scaled by resultant length (none below 0.1, max 8%).
  `tintedSurface(scheme, tint, amount)` for `--ground`/`--surface`.
- Surface dot texture: 1.5 px dots at 52 px pitch, ink at 7%, dropped under
  `prefers-contrast: more` (Proposed).
- Fonts: `@fontsource/ibm-plex-sans` and `@fontsource/ibm-plex-mono`, imported in
  `src/index.tsx` (Proposed).

## How to Verify

`vp check`, `vp test` and `vp build` pass. `theme.test.ts` covers the thresholds
and hysteresis band, the circular mean across 0/360, no tint for grays and evenly
spread hues, and 4.5:1 for ink and muted on the tinted surface for every hue in 15°
steps, both schemes, full tint.
