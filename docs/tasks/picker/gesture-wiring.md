---
title: Gesture wiring
status: todo
deps: [cube/gestures, picker/compose, picker/transitions]
summary: "useGestures.ts: tracked drag and pinch, panel drag, wheel, dblclick"
---

# Gesture wiring

## Goal

Connect real pointer, wheel and double-click input to the classifiers and the
transition controller, so drags and pinches track and everything else triggers.

## Design

Spec [§5](../../hsl-picker/design-spec.md#5-interaction-and-input-handling), [§6.4](../../hsl-picker/design-spec.md#64-panel-drop). File
`src/picker/useGestures.ts`.

- Grid region: `pointerGesture` events drive tracked turns and pinches;
  `setPointerCapture` after the slop; a one-shot capture-phase click swallower
  (ignores `detail === 0`, disarmed on next `pointerdown` or 300 ms after
  `pointerup`); `touch-action: none`.
- Wheel: non-passive listener added in `onMount`, removed in `onCleanup`, through
  `wheelGesture`; triggered actions.
- `dblclick` on a patch: zoom, `altKey` zooms out.
- Panel drag: down from the ceiling, up on the open panel's header; the slider
  track never starts a drag. Past the slop it captures the pointer and arms the
  same click swallower, so the ceiling's own click doesn't toggle the panel back
  and a drag that leaves the button still settles.
- Triggered input during a tracked drag is ignored.

## How to Verify

`vp test`: wheel and dblclick dispatch through the controller (jsdom can
synthesize these). Drag and pinch recognition is covered by `cube/gestures`; verify
on a real touch device and trackpad in Storybook: drag turns and settles, pinch
zooms across levels, a drag never picks the patch under the finger, the ceiling
drag opens and closes the panel without the button's click toggling it back.
