# HSL Cube Picker — color Progress Log

Execution log for the `color` epic: what was done and how, key decisions, what
works, what doesn't. Task status lives in each task file's frontmatter; this file is
the narrative beside it. Append entries (`tasks log <id> "…"`); don't rewrite earlier ones.

## Epic summary

- `src/color/hsl.ts` is the color core: `Hsl`, `normalizeHue`, `roundHsl`, `toCss`, `toHex`,
  `relativeLuminance`, `INK_ON_COLOR`, `contrastInk`.
- `roundHsl` is the only rounding point: it clamps s/l to [0, 100], rounds each to 0.1 half-up
  in decimal (2.55 → 2.6), and normalizes the hue before and after (359.96 → 0). Store its output.
- `toCss`/`toHex`/`relativeLuminance` assume in-range input and don't clamp or round.
- `INK_ON_COLOR` is exported; building the `picker.inkOnColor` tokens from it in `panda.config.ts`
  is left to `picker/theme`.

## hsl

**Status:** done
**Updated:** 2026-10-19

- 2026-10-19: filed. Goal: Hsl type, normalize/round, toCss, toHex, contrastInk in src/color/
- 2026-10-19: Started. Decisions: roundHsl rounds halves decimal-correctly (2.55→2.6) and clamps s/l to [0,100]; toCss prints as-is (no re-rounding); panda.config wiring left to picker/theme.
- 2026-10-19: Implemented src/color/hsl.ts + hsl.test.ts (31 tests); vp check and vp test green. Gotchas: the spec's ((h%360)+360)%360 adds float noise to in-range hues (56.4 → 56.399…), so normalizeHue adds 360 only to negatives; roundTenth cleans binary noise with toPrecision(12) before Math.round (15 digits wasn't enough for 725.55 % 360). Hue is normalized before rounding, so -0.05 → 359.95 → 0. Fixed spec §3.1: hex example is #478FD7 (not #4A8FD6); documented clamp and rounding rule.
- 2026-10-19: Review (bugs/tests/types/docs/conventions): one fix — normalizeHue(-1e-14) returned 360; negative branch now wraps exactly-360 to 0, test added (34 tests total). Declined: clamping in toHex/relativeLuminance and NaN handling — callers pass rounded, validated colors.
- 2026-10-19: Done. Landed: src/color/hsl.ts exports Hsl, normalizeHue, roundHsl, toCss, toHex, relativeLuminance, INK_ON_COLOR, contrastInk. For dependents: roundHsl clamps s/l and is the only rounding point — store its output; toCss does not round; INK_ON_COLOR is exported but panda.config.ts tokens are still to be wired by picker/theme. Verified: vp check, vp test (34), vp build.
