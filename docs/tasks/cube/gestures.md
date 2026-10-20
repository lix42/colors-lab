---
title: Gesture classifiers
status: todo
deps: [cube/reducer]
summary: pointerGesture, pinchProgress, velocity, wheel reducer in gestures.ts
---

# Gesture classifiers

## Goal

Turn raw pointer and wheel events into picker intents as pure reducers, so drag,
pinch and wheel recognition is unit-tested instead of relying on jsdom.

## Design

Spec [§5.1–5.4](../../hsl-picker/design-spec.md#51-pointer-swipe), [§6.1 settle rule](../../hsl-picker/design-spec.md#61-transition-controller),
[§6.3](../../hsl-picker/design-spec.md#63-zoom). File `src/hsl/gestures.ts`.

- `pointerGesture(state, event)`: tracks pointers; one pointer past a 10 px slop
  locks a `TurnDirection` (drag left → `"right"`) and emits `start` / `progress`
  / `end`; dragging back holds at 0. A second pointer makes it a pinch for the rest
  of its life (cancelling any tracked turn); a third is ignored; `pointercancel`
  ends it.
- `pinchProgress(anchor, distance)` = `log2(distance / anchor)`, direction locked
  past ±0.1, re-anchored at each whole level.
- `velocity(samples)` over the last 100 ms.
- `wheelGesture(state, { dx, dy, shift, time })`: one action per burst (30 px
  threshold, 150 ms gap ends a burst); `shift` (Shift or Ctrl) zooms using
  `dy || dx`, otherwise turns.

## How to Verify

`vp test` passes, covering: slop and axis lock; hold at 0 on drag-back; pinch
promotion is permanent and cancels a tracked turn; `pointercancel`; pinch log2,
re-anchor and ±0.1 lock; `velocity` window; wheel one-action-per-burst, 150 ms
reset, Shift with `dx` only, Ctrl + wheel zooms.
