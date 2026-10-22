---
title: Transitions and animations
status: todo
deps: [picker/compose]
summary: "motion.ts + transition.ts: triggered/tracked turn, zoom, panel drop; settling; reduced motion"
---

# Transitions and animations

## Goal

Animated turn, zoom and panel drop, playable both as triggered animations and as
tracked progress that a gesture drives and then settles.

## Design

Spec [§6](../../hsl-picker/design-spec.md#6-animation).

- `src/hsl/motion.ts`: pure `turnFrame(direction, p)`, `zoomFrame(delta, p)`,
  `dropFrame(p)`, `relayFrame(shift, p)` (the edge rule's re-lay slide, spec §6.5)
  and `settle(progress, velocity)` (fling ≥ 0.5 px/ms decides by
  direction, else progress ≥ 0.5).
- `src/picker/transition.ts`: one transition at a time,
  `{ action, target, mode, progress }`; tracked progress written per animation
  frame; triggered/settling via `element.animate` with duration scaled by distance
  left (≥ 120 ms); commit re-applies the action to the current state; the preview is
  `inert` and `aria-hidden`; interruption finishes the running one first.
- `HslPicker` routes `turn`, `zoom`, `toggleExpanded` and the edge rule's re-lay
  (`reachEnd`, and a `move` that re-lays) through it and renders
  current + target during a transition.
- Zoom limit rubber band (≤ 0.15, always cancels). Reduced motion: instant
  triggered/settle, cross-fade for tracked (Deviation).
- Exposes the tracked API (`begin` / `progress` / `end`) that
  `picker/gesture-wiring` drives.

## How to Verify

`vp test`: frames at 0 and 1 match resting states; `settle` at 0.5 and flings
both ways; rubber band never commits; a pick during a transition survives commit;
a triggered turn/zoom/drop ends in the reducer's state. Manual check in Storybook,
with and without reduced motion.
