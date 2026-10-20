# HSL Cube Picker — Tasks

A mobile-first HSL color picker built as a cube: the grid shows two variables and the
slider ("ceiling") the third; swiping turns the cube to swap them, and zoom refines the
grid. The demo is a palette page that opens the picker and keeps the chosen colors.

- **What and why:** [hsl-picker/requirements.md](hsl-picker/requirements.md)
- **How:** [hsl-picker/design-spec.md](hsl-picker/design-spec.md). Where the two
  disagree, the spec wins. Each task links the spec sections it implements.

> **Progress log:** one file per epic under [progress/](progress/) records _how_ each task is carried
> out. Before starting a task, read your epic's progress file in full, plus the `Epic summary` of
> every epic it depends on; log as you work with `tasks log <id> "…"`.

## Design

Stack: Solid, Panda CSS v2, Vite+ (`vp check`, `vp test`, `vp build`), Vitest with
jsdom, Storybook. Pure functions over classes; every rule that can be pure is, and is
unit-tested without the DOM.

### Architecture

- **`color`** (`src/color/`) — color types and conversions, independent of any picker.
  HSL now; OKLCH, LAB and gamut mapping later.
- **`cube`** (`src/hsl/`) — the pure HSL cube model: faces and turns, the zoom lattice,
  face data (cells, peek strips, ceiling), the picker reducer, and gesture
  classifiers. No Solid or DOM imports.
- **`picker`** (`src/picker/`, plus `src/hsl/theme.ts`, `src/hsl/motion.ts` and
  `panda.config.ts`) — Solid components, the adaptive light/dark theme, transitions
  and gesture wiring. Components render state and translate events into reducer
  actions; they hold no logic beyond wiring.
- **`palette`** (`src/palette/`, `src/App.tsx`) — the demo host: palette page,
  persistence, and removal of the old slider demo.
