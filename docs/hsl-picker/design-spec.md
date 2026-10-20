# HSL Cube Picker — Design Spec

This document describes _how_ the picker is built in this repo (Solid, Panda CSS, Vite+, Vitest, Storybook). _What_ it does and _why_ live in [`requirements.md`](requirements.md); where the two disagree, this spec wins. Problems found in the requirements are called out here, not edited back into them.

Items marked **Proposed** settle something the requirements left open. They are this spec's recommendation, open to change in review.

## 1. Scope and non-goals

In scope:

- The `HslPicker` component: faces, turning, ceiling and depth slider, zoom, peek strips, confirm/cancel.
- The palette demo page that hosts it, replacing the current `src/App.tsx` demo.
- Unit tests for the pure core, component tests, and Storybook stories.

Non-goals (for this iteration):

- Other color spaces (OKLCH, LAB) or alpha. Output is HSL plus a hex string for display.
- Physical-cube rotation (24 orientations, flipped axes). The requirements fix the six-face model.
- Publishing the picker as a package, SSR, or routing.

## 2. Architecture overview

Three layers, each depending only on the layers before it:

1. **Pure core** (`src/color/` and `src/hsl/`): plain TypeScript, no Solid or DOM imports. Color math (`src/color/`, shared by future color spaces), the cube model, the zoom lattice, the picker state reducer, and gesture classification. Everything here is a pure function with unit tests, in line with the repo's preference for pure functions over classes.
2. **Components** (`src/picker/`): Solid components that render the state and translate DOM events into reducer actions. They hold no logic beyond wiring.
3. **Demo host** (`src/palette/`): the palette page that opens the picker and stores the results.

### Module layout

```
src/
  color/
    hsl.ts           Hsl type, normalize/round, toCss, toHex, relativeLuminance, INK_ON_COLOR, contrastInk
    hsl.test.ts
  hsl/
    cube.ts          Variable, Face, START_FACE, turn(), variable metadata
    lattice.ts       axisWindow(): patch values for one axis at a zoom level
    face.ts          faceLayout(), patchColor(), faceColors(), peekStrips(), ceilingStops(), CSS formula strings
    state.ts         PickerState, PickerAction, pickerReducer()
    gestures.ts      pointerGesture(), pinchProgress(), velocity(), wheel gesture reducer
    motion.ts        turnFrame(), zoomFrame(), dropFrame(), settle()
    theme.ts         screenScheme(), tintedSurface()
    *.test.ts        one test file per module
  picker/
    HslPicker.tsx    public component; owns state; animation driver
    transition.ts    transition controller: tracked progress, triggered playback, settling
    PickerFace.tsx   one face: ceiling, grid region, zoom control, hints
    Ceiling.tsx      collapsed perspective gradient (a button)
    DepthPanel.tsx   expanded panel: swatch + vertical DepthSlider
    FaceGrid.tsx     5 × 7 patch radiogroup with keyboard handling
    PeekStrip.tsx    one edge strip (a button)
    ZoomControl.tsx  − / level / + buttons
    useGestures.ts   pointer, wheel and dblclick wiring for the grid
    *.stories.tsx, *.test.tsx
  palette/
    PalettePage.tsx  landing page, + button, picker host
    storage.ts       palette persistence (pure parse/serialize + thin I/O)
  App.tsx            renders PalettePage
```

### Existing code

- **`src/App.tsx`** is reduced to rendering `PalettePage`. The three-slider demo is removed.
- **`src/Slider.tsx`**, its story and its tests are **removed** in the final task (**Proposed**). Its layout (label left, number right, horizontal) does not fit the depth slider, which is vertical and styled as a gradient track. `DepthSlider` (inside `DepthPanel.tsx`) is a new component. The `Number(e.currentTarget.value)` regression test carries over to `DepthSlider`'s tests.

## 3. Domain model (pure functions)

### 3.1 Color types and conversions

```ts
type Hsl = { h: number; s: number; l: number }; // h in [0, 360), s and l in [0, 100]

normalizeHue(h: number): number;        // into [0, 360); exact for in-range hues
roundHsl(c: Hsl): Hsl;                  // clamp s, l to [0, 100]; each to 0.1, half up in decimal (2.55 → 2.6); hue normalized before and after (359.96 → 0)
toCss(c: Hsl): string;                  // "hsl(210 64% 56%)"
toHex(c: Hsl): string;                  // "#478FD7", uppercase
relativeLuminance(c: Hsl): number;      // WCAG, sRGB linearized; also used by theme.ts for CIE L*
const INK_ON_COLOR = { dark: "#1A1A19", light: "#FFFFFF" } as const;
contrastInk(c: Hsl): "dark" | "light";  // WCAG relative luminance; higher contrast ratio wins
```

- `roundHsl` is the single place values are rounded. The reducer stores only rounded colors, so stored, displayed and returned values always agree (requirements: _Callback value_).
- `contrastInk` returns a token name, not a hex color. Components map it to the scheme-independent `picker.inkOnColor.dark` and `picker.inkOnColor.light` tokens ([§7](#7-styling)), never to the scheme's `picker.ink`, and `contrastInk` compares against those exact colors. `INK_ON_COLOR` is the single source for them: `panda.config.ts` builds the two tokens from it rather than repeating the hex values.

### 3.2 Cube state

```ts
type Variable = "h" | "s" | "l";
type Face = { depth: Variable; x: Variable; y: Variable }; // all three distinct
const START_FACE: Face = { depth: "l", x: "h", y: "s" };

const VARIABLES: Record<Variable, { name: string; unit: "°" | "%"; max: number; wraps: boolean }>;
// h: Hue, °, 360, wraps · s: Saturation, %, 100 · l: Lightness, %, 100
```

`Face` is a plain object with six valid values; tests enumerate them.

### 3.3 Turning

```ts
type TurnAxis = "horizontal" | "vertical";
type TurnDirection = "left" | "right" | "up" | "down"; // animation only

turn(face: Face, axis: TurnAxis): Face;
// horizontal: { depth: face.x, x: face.depth, y: face.y }
// vertical:   { depth: face.y, x: face.x,     y: face.depth }

axisOf(direction: TurnDirection): TurnAxis;
```

The direction never affects the resulting face (requirements: opposite swipes do the same swap); it is kept only so the animation knows which way to rotate. Tests assert that alternating `horizontal` and `vertical` six times visits all six faces and returns to `START_FACE`, and that `turn(turn(f, a), a)` equals `f`.

### 3.4 Grid window and zoom

```ts
type ZoomLevel = 0 | 1 | 2 | 3 | 4; // shown as 2^z: 1×, 2×, 4×, 8×, 16×

type AxisWindow = {
  values: number[]; // n patch values, ascending (hue: ascending modulo 360)
  nearest: number;  // index of the value nearest the selection
  exact: boolean;   // selection equals values[nearest] rounded to 0.1
  step: number;     // lattice step at this zoom
  first: number;    // k₀ · step, values[0] before normalizeHue (hue: may be negative)
};

axisWindow(variable: Variable, n: number, zoom: ZoomLevel, center: number, selected: number): AxisWindow;
```

The lattice is fixed per variable, axis length and zoom level (requirements: _Each level has fixed patch values_):

- **S and L.** `steps = (n − 1) · 2^z`, `step = 100 / steps`; the lattice is `k · step` for integer `k` in `[0, steps]`. With `c = round(center / step)`, the window starts at `clamp(c − ⌊n/2⌋, 0, steps − (n − 1))` and holds `n` consecutive lattice values. It always fits, so there are no empty cells.
- **H.** `steps = n · 2^z`, `step = 360 / steps`. With `c = round(center / step) mod steps`, the window is `k = c − ⌊n/2⌋ … c + ⌈n/2⌉ − 1`, each value `normalizeHue(k · step)`. Hue never shifts; it wraps.
- **Window center** (**Proposed**; see [§11](#11-open-questions-carried-from-requirements)). The window is centered on `state.center` (§3.6), not on the selection, so picking a patch never moves the grid under the pointer. The center resets to the selection on turn and zoom. `axisWindow` itself owns the other case: when `selected` lies outside the window computed from `center` (for example a parent's new `value` in controlled mode), it centers on `selected` instead, so `nearest` and `exact` always describe a selection inside the window.
- **Exact vs. nearest.** A picked lattice value is stored rounded to 0.1 (16.67 becomes 16.7), so `exact` rounds `values[nearest]` the way `roundHsl` rounds that channel and compares it with `selected` for equality. A raw `|selected − value| ≤ 0.05` tolerance is not used: it misfires on lattice values ending in 5 in the hundredths, since 18.75 is stored as 18.8, which is `0.05000000000000071` away in floating point, so an exact pick would show a dashed ring.
- Values are computed as `k · step`, never by accumulating `step`, so there is no drift: `values[i]` is `(k₀ + i) · step`, normalized for hue. `step` and `first` are returned so `faceLayout` (§3.5) builds on the same lattice instead of re-deriving it (`first + i · step` matches `values[i]` to within float noise, not bit for bit); a step taken from `values[1] − values[0]` would be wrong across the hue wrap.

Grid dimensions are constants: `GRID_COLUMNS = 5` (x) and `GRID_ROWS = 7` (y).

### 3.5 Face layout, peek strips and ceiling gradient

On a face, each of H, S and L is a linear function of a patch's column and row: the x variable grows with the column, the y variable shrinks with the row (the top row is the maximum), and the depth variable is constant. The face is therefore described by nine numbers, three per variable, rather than by 35 colors. The components hand those nine numbers to CSS, which computes every patch's color ([§7.1](#71-patch-colors-in-css)); JS computes a single patch's color only when it needs one.

```ts
type Affine = { base: number; perCol: number; perRow: number }; // value = base + col · perCol + row · perRow
type FaceParams = Record<Variable, Affine>;
type Ring = { col: number; row: number; kind: "exact" | "approx" };

faceLayout(face: Face, center: Hsl, selection: Hsl, zoom: ZoomLevel): { params: FaceParams; ring: Ring };
patchColor(params: FaceParams, col: number, row: number): Hsl; // roundHsl of the three affine values
faceColors(params: FaceParams): Hsl[]; // patchColor at all GRID_ROWS × GRID_COLUMNS positions, top row first
peekStrips(face: Face, selection: Hsl, zoom: ZoomLevel): Record<"left" | "right" | "top" | "bottom", FaceParams>;
ceilingStops(face: Face, selection: Hsl, count?: number): Hsl[]; // full depth range, max first
```

- **Face layout**: x from `wx = axisWindow(face.x, GRID_COLUMNS, …)`, y from `wy = axisWindow(face.y, GRID_ROWS, …)`. Then `params[face.x] = { base: wx.first, perCol: wx.step, perRow: 0 }`, `params[face.y] = { base: wy.first + (GRID_ROWS − 1) · wy.step, perCol: 0, perRow: −wy.step }` (row 0 is the window's maximum) and `params[face.depth] = { base: selection[face.depth], perCol: 0, perRow: 0 }`. Bases are never normalized: a hue base on x can be negative, and one on y can be 360 or more. CSS and `roundHsl` both wrap them. The ring sits at column `wx.nearest` and row `GRID_ROWS − 1 − wy.nearest`: `exact` only when both axes are exact, otherwise `approx`.
- **`patchColor`** is how components get a patch's color: on pick, for the ringed patch's label, and for `faceColors`. The reducer doesn't use it: `move` works on `PickerState` through `axisWindow`, the lattice itself, including the window scroll at an edge (§3.6). `base + col · perCol + row · perRow` is a multiply-add, not the lattice's `k · step`, so it can differ from it in the last bits; `roundHsl`'s 12-digit rounding absorbs that, and a test pins it ([§10](#10-testing-strategy)).
- **`faceColors`** lists all 35 colors as `screenScheme`'s input ([§7](#7-styling)). It is not used for rendering. Production has one window-to-color mapping, `faceLayout` + `patchColor`; the independent reference, all 35 colors built from `axisWindow` directly, lives in `face.test.ts`.
- **Peek strips** follow the requirements' definition. They preview the face a turn would show, and a turn re-centers on the selection (§3.6), so every window they use is the re-centered one, `axisWindow` with the variable's selection value as both `center` and `selected`, never one from `center`; the strips always match the edge of the face that appears. Left/right: `axisWindow(face.depth, GRID_COLUMNS, …)` gives the depth window the new face would show on x; the strips use its first and last values, one cell per y value of the new face (`axisWindow(face.y, GRID_ROWS, …)`, unchanged by a horizontal turn). Top/bottom: `axisWindow(face.depth, GRID_ROWS, …)`, last and first values, one cell per x value of the new face (`axisWindow(face.x, GRID_COLUMNS, …)`). When `center` equals the selection, the strips' cells line up with the current grid's rows and columns. Each strip is returned as `FaceParams` in the same form as the grid: left/right cells are indexed by row (every `perCol` is 0), top/bottom cells by column (every `perRow` is 0), and the strip's depth value and the third variable go in `base`.
- **Ceiling stops**: `count` (default 13) evenly spaced depth values from max to 0 (hue: 359.9 to 0), with the other two variables at the selection. The ceiling is never zoomed. It is one gradient string, so it stays a JS-built CSS variable.

### 3.6 Picker state

All picker behavior is one reducer, so every interaction is testable without the DOM.

```ts
type PickerState = {
  face: Face;
  selection: Hsl;   // always rounded
  center: Hsl;      // grid window center (§3.4)
  zoom: ZoomLevel;
  expanded: boolean; // ceiling panel open
};

type PickerAction =
  | { type: "pick"; color: Hsl }                      // patch click / keyboard
  | { type: "setDepth"; value: number }               // depth slider
  | { type: "turn"; direction: TurnDirection }        // drag, wheel, peek strip, keyboard
  | { type: "zoom"; delta: 1 | -1 }                   // buttons, dblclick, pinch, Shift/Ctrl+wheel, keyboard
  | { type: "toggleExpanded" }                        // ceiling click or drag, Done
  | { type: "move"; dx: -1 | 0 | 1; dy: -1 | 0 | 1 }; // arrow keys in the grid

initialPickerState(initial?: Hsl): PickerState; // START_FACE, zoom 0, collapsed
pickerReducer(state: PickerState, action: PickerAction): PickerState;
```

Rules the reducer enforces:

- `turn` collapses the panel (`expanded: false`). `turn` and `zoom` reset `center` to the selection.
- `zoom` clamps to 0…4; a no-op zoom returns the same state object, so no transition starts.
- `move` steps to the neighbouring patch. At the grid edge it scrolls the window one lattice step along that axis; S and L stop at 0 and 100. (**Deviation**: the requirements say `move` stops at the grid edges. With a window that no longer follows the selection, scrolling is the only way to reach values outside it from the keyboard.)
- `pick` never changes `center`.
- `pick`, `move` and `setDepth` store `roundHsl` of the new color.

## 4. Components

### 4.1 `HslPicker` (public API, confirm callback)

```ts
type HslPickerProps = {
  value?: Hsl; // controlled: the selection; update it from onChange
  initialColor?: Hsl; // uncontrolled: starting selection, default hsl(210 64% 56%); ignored when value is set
  onChange?: (color: Hsl) => void; // every selection change, both modes; rounded, h in [0, 360)
  onConfirm: (color: Hsl) => void; // rounded, h in [0, 360)
  onCancel: () => void;
};
```

- Owns `const [state, setState] = createSignal(initialPickerState(props.value ?? props.initialColor))`. The displayed selection is `selection = () => (props.value !== undefined ? roundHsl(props.value) : state().selection)`.
- `view = () => ({ ...state(), selection: selection() })` is the state as displayed. `dispatch(a)` runs `pickerReducer(view(), a)`, stores the result, and calls `onChange` when the selection changed. In controlled mode the stored selection is ignored, so a pick shows only once the parent passes it back as `value`, and the parent can reject or adjust it.
- Only the selection is controllable. The face, zoom and panel stay internal in both modes. The mode is fixed at mount by whether `value` is defined, as in React; switching later isn't supported.
- Derived data (`faceLayout`, `peekStrips`, `ceilingStops`) are `createMemo`s over `view()`, so in controlled mode they follow the parent's `value`. None of them is a list of colors: the grid and strips get `FaceParams`, and the per-patch colors are computed by CSS ([§7.1](#71-patch-colors-in-css)).
- Renders the header (close button, title), the current `PickerFace` (plus the target's during a turn, [§6.1](#61-transition-controller)), and the confirm button. The confirm button's background is the selection ([§7](#7-styling)) and its label is `toCss(selection)`.
- Owns the transition controller ([§6.1](#61-transition-controller)): `turn`, `zoom` and `toggleExpanded` go through it instead of straight to `dispatch`.

### 4.2 `PickerFace`

Presentational. Props: the memoized face data, `expanded`, `zoom`, and `dispatch`. Top to bottom it lays out: the depth label row, `Ceiling`, the grid region (y-axis label, top strip, left strip, `FaceGrid`, right strip, bottom strip, x-axis labels), and a footer row with `ZoomControl` and the hints. When `expanded`, `DepthPanel` is absolutely positioned over the grid region as its sibling, not inside it, so slider pointer and wheel events never reach the turn and pinch listeners. The grid region is `inert` while expanded, so its hidden patches and strips leave the tab order.

Styles come from one `sva` slot recipe colocated in the file (slots: `root`, `depthLabel`, `gridRegion`, `axisLabel`, `footer`, `hint`).

### 4.3 `Ceiling` and expanded slider panel

- **`Ceiling`** is a `<button aria-expanded>` labelled "_Lightness 56%. Open slider_" (or "_Close slider_"). Inside, a span is tilted with CSS 3D: the wrapper sets `perspective: 300px; perspective-origin: 50% 100%`; the span sets `width: 72%; transform-origin: 50% 100%; transform: rotateX(-58deg)`. The gradient and the marker position are CSS variables ([§7](#7-styling)).
- **`DepthPanel`** contains the depth name and value (as the slider's `<label>`), a Done button, the swatch (color, `toCss`, `toHex`, ink from `contrastInk`), and `DepthSlider`.
- **`DepthSlider`** is a native `<input type="range">` with `writing-mode: vertical-lr; direction: rtl` (maximum at the top), `step=0.1` to match the stored precision, `max` 100 (hue: 359.9, so every valid hue is representable), `aria-valuetext` set to the formatted value, and `onInput` dispatching `setDepth` with `Number(e.currentTarget.value)`. A native input gives screen-reader behavior for free. Because 0.1 steps are too fine for the keyboard, a `keydown` handler makes the arrow keys step by 1 (10 with Shift) and Page Up/Down by 10.

### 4.4 `FaceGrid` and patches

Props: `params: FaceParams`, `ring: Ring`, the group's label and description, and `dispatch`. The grid never receives a list of colors.

- One container with `role="radiogroup"` and an `aria-label` such as "_Hue by Saturation at Lightness 56%_". Each patch is a `<button role="radio" aria-checked>`. (**Proposed**: radiogroup over the ARIA grid pattern. It conveys single selection directly; the 2D arrow keys are documented in the group's description.)
- **No per-patch updates.** The 35 buttons are created once and their color is never written again. The container carries the nine `FaceParams` as custom properties; each patch's `background` is a CSS formula with its own column and row written in as literals ([§7.1](#71-patch-colors-in-css)). A depth drag, zoom, turn or window scroll changes the container's properties and, at most, the ringed patch's label. Whether a patch is ringed is one `createSelector` over the ringed index, which drives the ring variant, `aria-checked`, `tabIndex` and which label a patch shows, so a ring move re-runs only the two patches it leaves and enters. The ringed patch's label also reads `params`, so it follows a depth step; no other patch reads anything reactive.
- **Patch labels** (**Deviation**: the requirements label every patch with its `hsl()` value): the ringed patch is labelled `toCss(patchColor(params, col, row))`, the lattice value a pick there returns; every other patch keeps a fixed positional label, counted from 1 like the radiogroup's position (`Column ${col + 1}, row ${row + 1}`, so the top-left patch is "_Column 1, row 1_"). With the roving tabindex, keyboard focus only ever lands on the ringed patch, so a user moving through the grid always hears a real value; reading other patches in a screen reader's browse mode gives their position, and the radiogroup adds "_3 of 35_" itself. A label for every patch would have to change on every depth step, which is exactly the per-patch update this design avoids; this way one label changes. A label that CSS computes (a hidden element with generated content, referenced by `aria-labelledby`) does not work: Chromium leaves `counter()` values out of the accessible name.
- **Roving tabindex**: only the ringed patch has `tabIndex=0`; the rest have `-1`. Tab enters and leaves the grid in one stop. Arrow keys move DOM focus to the newly ringed patch (`.focus()` after the `move`), so screen readers announce the new selection.
- **Approximate rings**: `aria-checked` is true only on an `exact` ring. With an `approx` ring no radio is checked; the ringed patch still holds `tabIndex=0`, and the group's description names the actual selection ("_Selected hsl(212.5 64% 56%), between patches_"), so assistive technology never reports a value Confirm won't return.
- **Picking**: a patch's click handler dispatches `pick` with `patchColor(props.params, col, row)`, read at click time, computing only its own color, and only when clicked.
- Rendered with `<Index>` over the 35 positions. The count never changes, so `Index` creates each button once and keeps it, with its focus, for the life of the grid. Each button's `col` and `row` are fixed by its index.
- Patch size is fixed at 48 px with a 4 px gap. The ring is a `cva` variant: `ring: none | exact | approx` (solid vs. dashed outline).

### 4.5 `PeekStrip`

A `<button>` with an `aria-label` naming the turn ("_Turn sideways: put Hue on the slider_"). It receives the strip's `FaceParams` and renders its 5 or 7 cells as flex children, colored by the same CSS formula as the patches ([§7.1](#71-patch-colors-in-css)), and dispatches `turn` with its direction. The strip is 14 px thick; a `::after` pseudo-element extends the hit area by 10 px on each side.

### 4.6 Zoom control

Two `<button>`s ("Zoom out", "Zoom in", disabled at the limits) around the level text (`1×` … `16×`), dispatching `zoom`.

### 4.7 Palette demo page

`PalettePage` holds `palette: Hsl[]` and `pickerOpen: boolean` signals. It renders the card grid (swatch, `toCss`, `toHex`) and the floating + button. While the picker is open it renders `HslPicker` full screen with `initialColor` set to the last palette entry; `onConfirm` appends and closes, and `onCancel` closes. Persistence: [§9](#9-state-and-persistence).

## 5. Interaction and input handling

All handlers live in `useGestures.ts` (a function that takes the grid region, ceiling and panel header elements, `dispatch` and the transition controller, and registers listeners) and call the pure helpers in `src/hsl/gestures.ts`. Drags and pinches start tracked transitions; everything else starts triggered ones ([§6](#6-animation)).

### 5.1 Pointer swipe

- Turn and pinch listeners sit on the grid region only (patches and peek strips), never on the ceiling, panel, zoom control or confirm button. The panel drag has its own listeners on the ceiling and the panel header ([§6.4](#64-panel-drop)). Both have `touch-action: none` so the browser doesn't pan or scroll.
- A pure reducer, `pointerGesture(state, event)`, tracks the active pointers through `pointerdown`, `pointermove`, `pointerup` and `pointercancel`. It emits `start` once a one-pointer drag passes a 10 px slop and locks its dominant axis into a `TurnDirection` (drag left → `"right"`, so the face from the right comes in; drag up → `"down"`), then `progress` on each move, and `end` with the release velocity. A lift before the slop emits nothing, so it stays a click.
- **Drag vs. click**: once a drag passes the slop, the grid region calls `setPointerCapture`, so `pointermove` and `pointerup` keep arriving after the pointer leaves the grid and the drag always settles. A one-shot capture-phase listener on the grid region swallows the `click` that follows, so the patch under the finger isn't picked; it ignores clicks with `detail === 0` (keyboard-generated), and is disarmed on the next `pointerdown` or 300 ms after `pointerup`, whichever comes first, in case the browser sent no click. Capture starts only after the slop, so taps keep their normal click target.
- `pointercancel` settles the tracked transition as a cancel.

### 5.2 Wheel and Shift + wheel

- One `wheel` listener on the grid region, added with `addEventListener(…, { passive: false })` in `onMount` and removed in `onCleanup`, so it can `preventDefault()` page scrolling.
- A pure reducer, `wheelGesture(state, { dx, dy, shift, time }) → { state, action | null }`, groups events into **gestures**. A gesture ends after 150 ms with no wheel events. Within one gesture, deltas accumulate until one axis passes 30 px, which emits exactly one action; the rest of the gesture is ignored. That covers trackpad inertia (requirements: _at most once_).
- With `shift`, the action is `zoom`, using `dy || dx` because macOS turns Shift + wheel into horizontal deltas; scrolling up or left zooms in. Without `shift`, the action is `turn`, with the same direction mapping as swipes. Ctrl counts as Shift (`shift` is `shiftKey || ctrlKey`): browsers report a trackpad pinch as wheel events with `ctrlKey` set, which would otherwise zoom the page.

### 5.3 Double-click

`dblclick` on a patch starts a `zoom` with `delta: e.altKey ? -1 : 1`. The two `click`s before it have already picked the patch, and a pick never moves the window ([§3.4](#34-grid-window-and-zoom)), so both clicks land on the same color.

### 5.4 Pinch-to-zoom

A swipe is a one-pointer gesture, so pointer events from a pinch are never classified as one.

- When a second pointer goes down, `pointerGesture` turns the gesture into a pinch for the rest of its life. No swipe is classified, even after one finger lifts, and the click after it is swallowed as in [§5.1](#51-pointer-swipe). If a one-finger turn is already tracking, it cancels and settles back, and the pinch starts from there. A third pointer is ignored.
- `pinchProgress(anchor, distance)` turns the pinch into tracked zoom progress, one level per doubling of the distance between the two pointers ([§6.3](#63-zoom)).
- Zoom stays centered on the selection (requirements: _Zoom centers on the selected color_); the pinch midpoint is ignored.
- The gesture ends when the last pointer lifts or is cancelled.

### 5.5 Keyboard

In the grid (**Proposed**, resolving the requirements' _Keyboard turning_ question):

| Key           | Action                                                         |
| ------------- | -------------------------------------------------------------- |
| Arrow keys    | `move` to the neighbouring patch (scrolls at edges)            |
| Shift + Arrow | `turn` in that direction                                       |
| `+` / `-`     | `zoom` in / out                                                |
| Enter / Space | `pick` (the focused patch is already selected; kept for habit) |

Shift + Arrow only applies while focus is in the grid, so it cannot clash with the depth slider's own arrow keys. After a turn, focus stays on the grid's ringed patch.

## 6. Animation

Turn, zoom and the panel drop are **transitions**: each moves the picker from its current state to a target state. Every transition plays in one of two modes (**Proposed** terms):

- **Triggered**: a click, key, wheel gesture or double-click starts it, and it plays to the end on its own.
- **Tracked**: a drag or pinch drives its progress directly, from 0 (the current state) to 1 (the target). When the finger lifts, the transition **settles**: it either **commits** (plays on to 1) or **cancels** (plays back to 0).

| Transition | Triggered by                                                 | Tracked by                                                     | Tracked progress                                                                   | Base duration |
| ---------- | ------------------------------------------------------------ | -------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------- |
| Turn       | Peek strip, Shift + Arrow, wheel                             | One-finger drag on the grid                                    | Drag distance along the locked axis ÷ face width (horizontal) or height (vertical) | 500 ms        |
| Zoom       | Zoom buttons, double-click, `+` / `-`, Shift or Ctrl + wheel | Pinch on the grid                                              | `log2(pointer distance ÷ anchor distance)`, one level per doubling                 | 320 ms        |
| Panel drop | Ceiling click, Done button                                   | Drag down from the ceiling; drag up on the open panel's header | Drag distance ÷ panel height                                                       | 420 ms        |

### 6.1 Transition controller

- `src/picker/transition.ts` holds one transition at a time: `{ action, target, mode, progress }`, where `target = pickerReducer(state, action)`. Because the reducer is pure, the target is known before anything moves.
- The state changes on commit, not at the start. While a transition runs, `HslPicker` renders both states: the target face beside the current one for a turn, the target grid over the current one for a zoom, and the panel for a drop. `target` is a preview for rendering only: its elements are `inert` and `aria-hidden`, so they never take focus, clicks or screen-reader attention. On commit the controller applies `pickerReducer(currentState, action)` to the state at that moment, so picks, moves and depth changes made during the transition survive; on cancel it drops the preview. Both read `view()` (§4.1), so controlled mode previews the parent's value.
- Frames are pure functions of progress in `src/hsl/motion.ts`: `turnFrame(direction, p)`, `zoomFrame(delta, p)` and `dropFrame(p)` return the transform and opacity of each animated element at progress `p`.
- **Tracked**: each `pointermove` sets the progress, and the next animation frame writes `frame(p)` to the elements' styles. Progress maps linearly to the finger, with no easing.
- **Triggered and settling**: one `element.animate([frame(from), frame(to)], { duration, easing: "cubic-bezier(.2, .7, .2, 1)" })` per element, from the current progress to 0 or 1. The duration is the base duration × the distance left, at least 120 ms, so a nearly finished drag settles quickly.
- **Settle rule**: a pure `settle(progress, velocity)` returns `"commit"` or `"cancel"`. A fling decides by its direction: at least 0.5 px/ms toward the target commits, even from a small progress, and the same speed back cancels. Otherwise it commits when progress ≥ 0.5. `velocity(samples)` in `gestures.ts` reads the pointer samples of the last 100 ms. A pinch settles by progress alone.
- **Interruption**: input that arrives while a transition plays or settles finishes it at once, applying its commit or cancel, and then starts. Triggered input (keys, wheel, buttons) during a tracked drag is ignored.
- **Reduced motion** (**Deviation**: the requirements disable these animations outright): triggered transitions and settles apply instantly, with no `animate()`. A tracked transition shows no rotation, scaling or drop: the target cross-fades in as the finger moves, so the gesture still works and commits the same way, without 3D motion. Any CSS transitions use Panda's `_motionReduce` condition.
- The ceiling's static tilt is plain CSS.

### 6.2 Turn

- Past a 10 px slop, a one-finger drag locks its dominant axis and direction ([§5.1](#51-pointer-swipe)). Dragging back past the start holds progress at 0; it never switches to the opposite turn mid-drag.
- `turnFrame`: both faces rotate about the cube's center, `transform-origin: 50% 50% calc(var(--face-width) / -2)` for left and right turns and `calc(var(--face-height) / -2)` for up and down, so the two faces share an edge, under `perspective(1200px)`. The current face goes from none to `rotateY(∓90deg)` (`rotateX` for up and down) and fades 1 → 0.2; the target face goes from `rotateY(±90deg)` to none and fades 0.2 → 1.
- A committed turn collapses the panel, per the reducer rule.

### 6.3 Zoom

- `pinchProgress(anchor, distance)` returns `log2(distance / anchor)`: positive zooms in, negative zooms out. The anchor starts as the distance when the second pointer goes down. The direction locks once the progress passes ±0.1; after that, pinching back past the anchor holds at 0, as a drag does, so the target never flips. When progress reaches ±1, that level commits and the anchor resets to the current distance, so one pinch can travel several levels.
- At a zoom limit, progress is damped to at most 0.15 and always cancels: a rubber band that shows there is no further level.
- `zoomFrame`, with the origin at the ringed patch's center: zooming in, the current grid scales 1 → 2 and fades out while the target grid scales 0.5 → 1 and fades in. Zooming out mirrors it (1 → 0.5, and 2 → 1).

### 6.4 Panel drop

- Dragging down from the ceiling opens the panel; dragging up on the open panel's header (the swatch row) closes it. The slider track never starts a drag, so it keeps its own pointer handling.
- `dropFrame`: `transform-origin: 50% 0`, from `perspective(900px) rotateX(-80deg)` at opacity 0 (progress 0) to none at opacity 1 (progress 1). Closing plays the same frames backward, so collapsing is now animated too.
- A drag past the slop captures the pointer and swallows the click, as in [§5.1](#51-pointer-swipe), so the ceiling doesn't also toggle.

## 7. Styling

- **Tokens** (`panda.config.ts`, `theme.extend`): semantic color tokens for the picker's UI in two **schemes**, light and dark, switched by a `data-scheme` attribute on the picker root through a custom Panda condition. Font tokens `body` and `mono`.

| Token                     | Light scheme | Dark scheme | Use                                                                                           |
| ------------------------- | ------------ | ----------- | --------------------------------------------------------------------------------------------- |
| `picker.ground`           | #E7E7E4      | #1C1C1B     | Page background, before tinting                                                               |
| `picker.surface`          | #F5F5F3      | #262624     | Face card and panel, before tinting                                                           |
| `picker.ink`              | #1A1A19      | #F2F2EF     | Text, rings, pattern                                                                          |
| `picker.muted`            | #595955      | #A8A8A2     | Secondary text, at least 4.5:1 on the tinted surface                                          |
| `picker.line`             | #D6D6D2      | #3A3A37     | Borders                                                                                       |
| `picker.inkOnColor.dark`  | #1A1A19      | #1A1A19     | Text on patches, swatch and confirm button when `contrastInk` says dark; same in both schemes |
| `picker.inkOnColor.light` | #FFFFFF      | #FFFFFF     | The same when `contrastInk` says light                                                        |

- **Adaptive scheme** (**Proposed**): the face's colors range from near-white to near-black, so no single surface works. A pure `screenScheme(colors, previous)` in `src/hsl/theme.ts` takes the colors on screen (the grid's, from `faceColors`) and returns the scheme: **dark** when their mean lightness (CIE L\*) is above 55, **light** when below 45, otherwise the previous scheme. The 10-point band stops it flickering as the user moves through mid tones. It is a memo over the displayed state, so it follows every pick, move and depth step, and each committed turn or zoom; it never reads a transition's preview, so it doesn't change mid-transition.
- **Tint**: `screenScheme` also returns a tint, the saturation-weighted circular mean of the on-screen hues. Its amount, up to 8%, grows with their mean saturation scaled by the mean's resultant length, so evenly spread hues (as on the starting 1× Hue axis) give no tint; below a resultant of 0.1 the tint is none. `tintedSurface(scheme, tint, amount)` mixes it into the ground and surface, and the results are passed as `--ground` and `--surface` (see Runtime colors). Ink, muted and line come from the scheme tokens alone, so text contrast doesn't depend on the tint.
- **Scheme changes** cross-fade `background-color` and `color` over 300 ms, instantly under reduced motion.
- **Texture** (**Proposed**): a dot pattern on the surface (face card and panel, not the ground), pitched at the patch spacing of 52 px so the dots sit in the gaps between patches, like graph paper. Each dot is 1.5 px in the scheme's ink at 7% opacity, so it follows the scheme. It is one static `radial-gradient` background with `background-size: 52px 52px`, offset by the grid's origin. It is dropped under `prefers-contrast: more`.
- **Ink on colors**: text on a patch, swatch or confirm button picks `picker.inkOnColor.dark` or `.light` with `contrastInk`; text on the surface uses the scheme's ink. The two `picker.inkOnColor` tokens are built from `INK_ON_COLOR` ([§3.1](#31-color-types-and-conversions)).
- **Fonts** (**Proposed**): IBM Plex Sans and IBM Plex Mono via the `@fontsource/ibm-plex-sans` and `@fontsource/ibm-plex-mono` dependencies, imported in `src/index.tsx`. They are self-hosted, versioned and work offline, unlike a Google Fonts link.
- **Runtime colors**: Panda extracts styles at build time, so per-selection values are passed as CSS custom properties on the element's `style` and consumed by static styles: `style={{ "--selection-color": toCss(c) }}` with `css({ bg: "var(--selection-color)" })`. The same applies to `--ceiling-gradient`, `--marker-top`, `--track-gradient`, `--ground`, `--surface`, `--face-width` and `--face-height`. No runtime value is ever interpolated into `css()`. Patch and peek-strip colors are the exception: CSS computes them ([§7.1](#71-patch-colors-in-css)).
- **Recipes**: colocated `sva` (PickerFace, DepthPanel) and `cva` (patch ring, peek strip orientation), not config recipes. They are single-use and read best next to their components.

### 7.1 Patch colors in CSS

The requirements make this project a playground for front-end techniques; this is one of them. Instead of JS writing 35 colors on every change, the grid container holds the face's nine numbers and CSS math functions turn them into each patch's color. A depth drag, the picker's most frequent update, writes one custom property (the depth variable's base) on the grid container, and the only patch it touches is the ringed one, whose label follows the value.

- **Container**: `faceVars(params)` (in `face.ts`) returns the nine custom properties, `--h-base`, `--h-col`, `--h-row`, and the same for `s` and `l`, as plain numbers. The grid container sets them on its `style`. Solid diffs `style` objects per key, so only values that changed are written: one on a depth step, four on a zoom, at most four on a window scroll, and up to all nine on a turn.
- **Patch**: `patchBackground(col, row)` (in `face.ts`) returns the patch's formula with its column and row written in as literals, never as custom properties:

  ```css
  hsl(calc(var(--h-base) + 2 * var(--h-col) + 3 * var(--h-row))
      calc((var(--s-base) + 2 * var(--s-col) + 3 * var(--s-row)) * 1%)
      calc((var(--l-base) + 2 * var(--l-col) + 3 * var(--l-row)) * 1%))
  ```

  The patch sets it as `style={{ background: patchBackground(col, row) }}`. The string reads no signal, so Solid writes it once, when the button is created, and never again. It goes in `style`, not `css()`: Panda extracts only literal styles at build time, and 35 strings built in a loop aren't.

- **Peek strips** use the same two functions, with the strip's `FaceParams` on the strip and each cell's index in the column or row slot (§3.5).
- **Why it works**:
  - Hue needs no `mod`: CSS normalizes any hue angle, so a negative `--h-base` or a sum past 360 paints the wrapped hue.
  - S and L are multiplied by `1%` for the `hsl()` percentage arguments.
  - The variables are inherited, unregistered custom properties, so no `@property` is needed. The formula sits on the patch and only its inputs on the container. That split matters: a custom property's `var()` references are resolved on the element that declares it, so a `--h: calc(…)` declared on the container would be computed there and inherited as a finished number.
  - During a turn or zoom, the preview face is its own grid with its own nine properties, so both faces render at once with no extra work.
- **Precision**: CSS paints the unrounded value, which differs from the rounded `patchColor` by less than 0.05 in any channel, far below a visible difference.
- **Failure mode**: if any of the nine properties is missing, the whole `background` is invalid and the patch turns transparent. `faceVars` always returns all nine, and its test checks that.
- **Cost**: when a container property changes, the browser still restyles and repaints all 35 patches; that was true before too. What goes away is the per-patch reactive work: no per-patch color strings or color writes, and no effect on any patch but the ringed one's label. `screenScheme` still evaluates the 35 colors in JS through `faceColors`, as plain math with no DOM; its mean CIE L\* is non-linear in the channels, so it can't be read off the nine numbers.

## 8. Accessibility

- Every control is a native `<button>` or `<input>`. Icon-only buttons (close, zoom, +) have `aria-label`s.
- Patch grid: radiogroup with roving tabindex and `aria-checked` ([§4.4](#44-facegrid-and-patches)). The group's accessible description lists the keys from [§5.5](#55-keyboard) and, with an approximate ring, names the actual selection ([§4.4](#44-facegrid-and-patches)). Only the ringed patch is labelled with its `hsl()` value; the others have positional labels (**Deviation**, [§4.4](#44-facegrid-and-patches)).
- Ceiling: `aria-expanded`. When the panel opens, focus moves to `DepthSlider`; when it closes, focus returns to the ceiling.
- After a turn, a visually hidden `aria-live="polite"` region announces the new face ("_Slider: Hue. Grid: Lightness by Saturation._").
- Focus order: close → ceiling → top strip → left strip → grid → right strip → bottom strip → zoom out → zoom in → confirm.
- Text on colored surfaces uses `contrastInk`. Neutral text tokens meet 4.5:1 on their grounds.
- Storybook's a11y addon (already installed) runs on every picker story.

## 9. State and persistence

- Picker state is local to `HslPicker` and starts fresh each time it opens.
- **Palette persistence** (**Proposed**, resolving the requirements' _Persistence_ question): `localStorage` under the key `colors-lab:palette:v1`. `storage.ts` separates pure `parsePalette(json: string | null): Hsl[]` (validates each entry, applies `roundHsl`, drops invalid ones, returns `[]` on bad input) and `serializePalette(p: Hsl[]): string` from thin `loadPalette()` / `savePalette()` wrappers. The wrappers catch storage errors (private mode, quota) and fall back to an in-memory palette.
- With an empty or unreadable store, the page starts with no colors and the picker opens with the default initial color.

## 10. Testing strategy

**Unit tests (Vitest)** for every `src/color/` and `src/hsl/` module and `palette/storage.ts`. Key cases:

- `color`: rounding at 0.05 boundaries; `359.96 → 0`; hex for known colors; `relativeLuminance` of black, white and mid gray; `contrastInk` against known WCAG pairs.
- `cube`: the six-face loop; `turn` twice returns the original; every direction maps to the right axis.
- `lattice`: at zoom 0 the S/L windows are exactly `[0, 25, 50, 75, 100]` (5 values) and the 7-value equivalent, whatever the selection; windows at the S/L ends shift but stay inside 0–100; hue wraps (selection 350° at 1×); `exact` vs. nearest after zooming out from a fine pick; no drift at zoom 4; a `selected` outside the window from `center` re-centers on `selected`; `normalizeHue(first + i · step)` matches `values[i]` after rounding the way `roundHsl` rounds the channel (not with exact equality: the sums differ in the last bits), including across the hue wrap; an exact pick of a value ending in 5 in the hundredths (S 18.75 at zoom 2) is `exact`.
- `face`: ring placement (`exact`/`approx`), top row is the y maximum, peek strip definitions, ceiling stops max-first. `patchColor(faceLayout(…).params, col, row)` equals the test file's reference grid (built from `axisWindow` directly) at every cell, for all six faces, every zoom level, selections at S/L 0 and 100 and hue windows across 0/360; the same for each peek strip against its `axisWindow` definition. `faceVars` returns all nine properties; `patchBackground(2, 3)` matches a snapshot.
- `state`: every action; turn collapses the panel; zoom clamps; `move` scrolls the window at its edges and stops at S/L 0 and 100; `pick` never moves the window; `turn` and `zoom` re-center it; stored values are always rounded.
- `gestures`: slop and axis lock; dragging back holds at 0; a second pointer turns a gesture into a pinch for good, and `pointercancel` ends it; `pinchProgress` is log2, re-anchors at each level and locks its direction past ±0.1; `velocity` over the 100 ms window; wheel gestures (one action per burst, the 150 ms reset, Shift with `dx` only, Ctrl + wheel zooms).
- `motion`: frames at progress 0 and 1 match the resting states; `settle` at 0.5 and for flings both ways; the zoom rubber band never commits.
- `theme`: scheme thresholds and the hysteresis band; circular hue mean across 0/360; grays and evenly spread hues give no tint; ink and muted keep 4.5:1 on the tinted surface for every hue in 15° steps, in both schemes, at full tint.

**Component tests** (`@solidjs/testing-library`, jsdom), driven by user-level events:

- `FaceGrid`: one Tab stop; arrows move `aria-checked` and `document.activeElement`; an `approx` ring leaves no radio checked; Shift + Arrow dispatches a turn; clicking a patch picks `patchColor` of its position; only the ringed patch has an `hsl()` label. A `MutationObserver` on the patches sees only the ringed patch's `aria-label` change on a depth change, and changes on only the old and new ringed patch on a ring move. jsdom doesn't evaluate `var()` or `calc()`, so painted colors are checked in Storybook (below).
- `Ceiling` / `DepthPanel`: toggling `aria-expanded`, focus moving into the panel and back, `DepthSlider` reporting numbers.
- `HslPicker`: confirm calls `onConfirm` with the rounded selection; cancel calls `onCancel`; double-click zooms. Controlled: a pick calls `onChange` but the ring moves only when `value` changes, and a new `value` from the parent moves it.
- jsdom has no layout and no real pointer gestures, so drag and pinch recognition and the settle rule are covered by the pure `pointerGesture`, `pinchProgress` and `settle` tests, not by component tests.

**Storybook** stories (with the a11y addon): `FaceGrid` on all six faces and at each zoom level, with a play function that compares a few patches' computed `background-color` (a real browser evaluates the CSS formula) against `toHex(patchColor(…))`, within one 8-bit step per channel; a selection at S = 0 and at S = 100; an approximate (dashed) ring; `Ceiling` collapsed and expanded; `PickerFace` composed; `HslPicker` interactive; `PalettePage` empty and populated.

## 11. Open questions carried from requirements

| Question                  | Status in this spec                                                                                                                                                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pinch-to-zoom             | In scope ([§5.4](#54-pinch-to-zoom)). A swipe is one pointer and a pinch two, so they don't conflict.                                                                                                                            |
| Opposite swipe directions | Settled by the requirements: same swap; direction only affects the animation.                                                                                                                                                    |
| Coarse hue at 1×          | Kept as specified (72° on x, about 51° on y). Revisit after hands-on testing.                                                                                                                                                    |
| Keyboard turning          | **Proposed**: Shift + Arrow within the grid ([§5.5](#55-keyboard)).                                                                                                                                                              |
| Persistence               | **Proposed**: `localStorage` with a versioned key ([§9](#9-state-and-persistence)).                                                                                                                                              |
| Desktop layout            | **Proposed**: the phone layout centered at `max-width: 430px`; no wider grid.                                                                                                                                                    |
| Fonts                     | **Proposed**: `@fontsource` packages ([§7](#7-styling)). Raised by this spec.                                                                                                                                                    |
| Surface texture           | **Proposed**: a dot grid at the patch spacing ([§7](#7-styling)). Alternatives are film grain (an SVG noise filter) or fine ruled lines. Raised in review.                                                                       |
| Patch labels              | **Deviation**: only the ringed patch is labelled with its `hsl()` value; the others have positional labels, so no label changes per patch ([§4.4](#44-facegrid-and-patches)). Raised in review.                                  |
| Window anchoring          | **Proposed**: a stored window center, so a pick never moves the grid ([§3.4](#34-grid-window-and-zoom)). Fixes double-click and keyboard edges, but changes how picking feels. Decide when building tasks 2–3. Raised in review. |

## 12. Task breakdown notes

Candidate tasks for `/tasks:tasks-setup`, in dependency order. Each is shippable on its own, with tests and, for components, a story.

1. **Color core**: `src/color/hsl.ts` and tests.
2. **Cube, lattice and face data**: `cube.ts`, `lattice.ts`, `face.ts` (including `faceLayout`, `patchColor`, `faceVars`, `patchBackground`) and tests. Depends on 1.
3. **Picker reducer**: `state.ts` and tests. Depends on 2.
4. **Gesture classifiers**: `gestures.ts` and tests: `pointerGesture`, `pinchProgress`, `velocity()` and the wheel reducer. Depends on 3.
5. **Theme, schemes and fonts**: `panda.config.ts` (two schemes, the scheme condition), surface pattern, font packages, `theme.ts` and tests. Depends on 1.
6. **FaceGrid**: radiogroup, roving tabindex, keyboard, ring variants, patch colors in CSS ([§7.1](#71-patch-colors-in-css)), ring-only labels, stories. Depends on 2, 3, 5.
7. **Ceiling, DepthPanel and DepthSlider**: stories, focus handling. Depends on 2, 3, 5.
8. **PeekStrip and ZoomControl**. Depends on 2, 3, 5.
9. **PickerFace and HslPicker composition**: confirm/cancel, live region. Depends on 6, 7, 8.
10. **Transitions and animations**: `motion.ts`, `transition.ts`; triggered and tracked modes, settling, turn, zoom and panel frames, reduced motion. Depends on 9.
11. **Gesture wiring**: `useGestures.ts` (tracked drag and pinch, panel drag, wheel, dblclick). Depends on 4, 9, 10.
12. **Palette page and persistence**: `PalettePage.tsx`, `storage.ts`, replace `App.tsx`, remove `Slider.tsx` with its story and tests. Depends on 9.

Task 1 comes first; 2 and 5 can then run in parallel, and once 3 and 5 land, tasks 4, 6, 7 and 8 can run in parallel too.
