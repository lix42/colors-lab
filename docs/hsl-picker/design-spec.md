# HSL Cube Picker — Design Spec

> **Status: outline.** Sections are placeholders, to be filled in a follow-up PR. Requirements live in [`requirements.md`](requirements.md).

This document describes _how_ the picker is built in this repo (Solid, Panda CSS, Vite+, Vitest, Storybook). Once filled in, it is the input for splitting the work into tasks.

## 1. Scope and non-goals

## 2. Architecture overview

- Module layout under `src/`
- Pure core vs. Solid components vs. demo host (palette page)
- Existing code: what happens to `src/Slider.tsx` (and its story and tests) and the current HSL demo in `src/App.tsx` — reuse, adapt (e.g. vertical slider), or remove

## 3. Domain model (pure functions)

### 3.1 Color types and conversions

- HSL value type, `hsl()` / hex formatting, contrast ink

### 3.2 Cube state

- Face (depth / x / y assignment), selection, zoom level

### 3.3 Turning

- Turn rule as a pure function; direction → swap

### 3.4 Grid window and zoom

- Fixed per-level lattice values; window of _n_ consecutive values centered on the one nearest the selection; S/L shift to stay inside 0–100%, hue wraps
- Exact vs. approximate selection (solid vs. dashed ring)

### 3.5 Peek strips and ceiling gradient

## 4. Components

### 4.1 `HslPicker` (public API, confirm callback)

### 4.2 `PickerFace`

### 4.3 `Ceiling` and expanded slider panel

### 4.4 `FaceGrid` and patches

### 4.5 `PeekStrip`

### 4.6 Zoom control

### 4.7 Palette demo page

## 5. Interaction and input handling

- Pointer swipe, wheel, Shift + wheel, double-click, Alt + double-click
- Gesture thresholds and throttling; swipe vs. click disambiguation
- Pinch-to-zoom (pending open question)

## 6. Animation

- 3D turn (transform origin, perspective, direction)
- Ceiling drop, zoom transitions
- `prefers-reduced-motion`

## 7. Styling

- Panda tokens (neutral palette, type), recipes, dynamic colors

## 8. Accessibility

- Roles, labels, focus order, keyboard turning

## 9. State and persistence

## 10. Testing strategy

- Vitest unit tests for the pure core
- Component tests (`@solidjs/testing-library`)
- Storybook stories per component and face state

## 11. Open questions carried from requirements

## 12. Task breakdown notes

- Candidate milestones and dependencies, for `/tasks:tasks-setup`
