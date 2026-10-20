# HSL Cube Picker — picker Progress Log

Execution log for the `picker` epic: what was done and how, key decisions, what
works, what doesn't. Task status lives in each task file's frontmatter; this file is
the narrative beside it. Append entries (`tasks log <id> "…"`); don't rewrite earlier ones.

## Epic summary

_Nothing yet._

## theme

**Status:** not started
**Updated:** 2026-10-20

- 2026-10-19: filed. Goal: Panda light/dark schemes, surface texture, fonts, theme.ts (screenScheme, tintedSurface)
- 2026-10-20: plan revised: screenScheme's colors come from faceCells, since patches are painted by CSS (spec §7.1).

## face-grid

**Status:** not started
**Updated:** 2026-10-20

- 2026-10-19: filed. Goal: 5 x 7 patch radiogroup: roving focus, keyboard, ring variants, stories
- 2026-10-20: plan revised: the grid gets FaceParams, not colors; the container carries faceVars, each patch's patchBackground is written once (spec §7.1). Only the ringed patch has an hsl() label, others are positional (Deviation, spec §4.4); one createSelector drives ring, aria-checked, tabIndex and label.
- 2026-10-20: plan revised after review: the ringed patch's label follows depth steps (a MutationObserver sees only that aria-label on a depth change); positional labels count from 1; the click reads props.params.

## depth-panel

**Status:** not started
**Updated:** 2026-10-19

- 2026-10-19: filed. Goal: collapsed ceiling button, expanded panel with vertical depth slider, focus handling

## peek-zoom

**Status:** not started
**Updated:** 2026-10-20

- 2026-10-19: filed. Goal: edge peek-strip buttons and the zoom -/level/+ control
- 2026-10-20: plan revised: strips get FaceParams from peekStrips and color their cells with faceVars + patchBackground, like the grid (spec §7.1).

## compose

**Status:** not started
**Updated:** 2026-10-20

- 2026-10-19: filed. Goal: public HslPicker: controlled/uncontrolled, confirm/cancel, live region
- 2026-10-20: plan revised: memos are faceLayout / peekStrips / ceilingStops; screenScheme is fed by faceCells on commit (spec §7.1).

## transitions

**Status:** not started
**Updated:** 2026-10-19

- 2026-10-19: filed. Goal: motion.ts + transition.ts: triggered/tracked turn, zoom, panel drop; settling; reduced motion

## gesture-wiring

**Status:** not started
**Updated:** 2026-10-19

- 2026-10-19: filed. Goal: useGestures.ts: tracked drag and pinch, panel drag, wheel, dblclick
