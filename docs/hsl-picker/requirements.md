# HSL Cube Picker — Requirements

A color picker whose real job is to **teach what HSL means**. It treats Hue, Saturation and Lightness as the three axes of a cube: the picker shows one face of the cube at a time, and the user turns the cube to see the color space from another side. The project is also a playground for front-end techniques (CSS 3D transforms, gesture handling, animation, accessible custom controls).

This document records _what_ the picker does and _why_. _How_ it is built lives in [`design-spec.md`](design-spec.md).

- **Interactive mock-up:** the "HSL Cube Picker" design canvas on claude.ai (https://claude.ai/artifact/7b1MaHD5zSiUTBfxQVafMb — private to the owner until shared). It has three boards: a playable prototype, a mid-rotation still, and a map of the six faces.
- **Original sketches:** [`sketches/`](sketches/) (see [Sketches](#sketches) for how they relate to the final rules).

## Glossary

| Term               | Meaning                                                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Variable**       | One of Hue (H, 0 ≤ H < 360°, wraps around: 360° is shown as 0°), Saturation (S, 0–100%) or Lightness (L, 0–100%).                      |
| **Depth variable** | The variable controlled by the slider. Think of it as the axis pointing into the screen.                                               |
| **Face**           | One view of the cube: a depth variable plus an assignment of the other two variables to the grid's x- and y-axes. There are six faces. |
| **Layer**          | The slice of the cube at the current depth value; the grid shows it.                                                                   |
| **Patch**          | One clickable cell of the grid.                                                                                                        |
| **Ceiling**        | The collapsed, perspective-tilted form of the slider at the top of the face.                                                           |
| **Peek strip**     | A thin strip on each edge of the grid previewing the face you would turn to (see [The picker face](#the-picker-face)).                 |

## Screens and flow

1. **Palette (landing page).** Shows the colors picked so far as cards (swatch, `hsl()` value, hex value). A floating **+** button opens the picker.
2. **Picker.** One face of the cube: the ceiling (slider) at the top, the grid of patches in the middle, and a confirm button at the bottom. A close button dismisses it without picking.
3. **Confirm.** The confirm button is filled with the selected color and labelled with its value. Pressing it calls back with the selected color; in this demo, the color is appended to the palette and the user returns to the landing page.

**Opening state.** The picker takes an optional initial color. There is always a selection, so Confirm is always enabled. The demo passes the most recently added palette color, or `hsl(210 64% 56%)` when the palette is empty. The picker opens on the starting face (see [Turning the cube](#turning-the-cube)) at zoom 1×, with the ceiling collapsed.

**Callback value.** Confirm returns `{ h, s, l }` as numbers rounded to 0.1, with `h` normalized to 0 ≤ h < 360 _after_ rounding (so 359.96 becomes 0, not 360). This is the same precision the UI displays, so the `hsl()` text shown on the palette round-trips to the stored color.

The picker is a reusable component: the palette page is only its demo host, and the confirm callback is its public contract.

## The picker face

Every face has the same layout and is rendered by one component; only the variable assignment differs.

- **Ceiling (top)** — see [The ceiling](#the-ceiling-slider).
- **Grid (middle)** — a fixed grid of patches showing the current layer: x-axis variable left→right (ascending), y-axis variable bottom→top (ascending). Axis names and the visible min/max values are labelled on the axes.
- **Selection** — clicking a patch sets the selection to that patch's color. The selection is always one full HSL color, and it is always on the current layer. The patch nearest the selection shows a ring: **solid** when the selection is exactly that patch's color, **dashed** when it only approximates it (for example after zooming out from a finer pick; see [Zoom](#zoom-fine-tuning)).
- **Peek strips** — on each of the four grid edges, a strip previews the face a turn in that direction leads to. Tapping a strip turns the cube that way. They make the cube's other sides visible and give touch and keyboard users a non-gesture way to turn.
  - **Left / right strips** show the current y-axis values (one cell per grid row) with the depth variable at the **minimum** (left) or **maximum** (right) of its window on the new face's x-axis: the 5 values that face would show there at the current zoom, centered on the selection.
  - **Top / bottom strips** show the current x-axis values (one cell per grid column) with the depth variable at the **maximum** (top) or **minimum** (bottom) of its window on the new face's y-axis: the 7 values that face would show there at the current zoom, centered on the selection.
  - Both strips on one axis lead to the **same** face (see [Turning the cube](#turning-the-cube)); they differ only in which end of the depth range they preview and in the direction of the turn animation.
- **Swap hint** — a short line states what each swipe direction would swap (e.g. "↔ H⇄L · ↕ S⇄L").
- **Confirm (bottom)** — see [Screens and flow](#screens-and-flow).

## Turning the cube

The slider variable is the cube's depth. Turning the cube brings the depth axis into the plane of the screen:

- **Horizontal swipe** (or horizontal scroll, or tapping the left or right peek strip): the **y-axis stays**; the depth variable and the x-axis variable swap.
- **Vertical swipe** (or vertical scroll, or tapping the top or bottom peek strip): the **x-axis stays**; the depth variable and the y-axis variable swap.

Consequences:

- The rule reaches all **six** faces (3 choices of depth × 2 orientations of the remaining pair). Alternating horizontal and vertical turns visits every face and returns to the start.
- **The selected color survives every turn.** It is the same point in the cube, so it appears in the new face's grid, ringed.
- The turn is animated as a 3D rotation of the face, in the direction of the swipe.
- Opposite directions (left vs right, up vs down) perform the same swap; only the animation direction differs.

Starting face: depth = Lightness, x = Hue, y = Saturation.

**Where gestures apply.** Swipes and scrolls turn the cube only when they start on the grid (including the peek strips). Gestures on the ceiling, the expanded slider panel, the zoom control or the confirm button never turn it, so dragging the vertical slider cannot be mistaken for a vertical swipe. A scroll gesture turns the cube **at most once**: the wheel events of one gesture, including trackpad inertia, count as one turn.

## The ceiling (slider)

- **Collapsed:** the slider is drawn as a ceiling — a gradient panel tilted back in perspective (wider at the near/top edge, narrower where it meets the grid). The gradient runs through the depth variable's **full range** with the other two variables held at the selection, maximum at the near edge. A line marks the current depth value. The depth variable's name and value are labelled above it.
- **On tap:** the ceiling swings down like a hatch into an expanded panel over the grid, containing a large swatch of the selected color (with its `hsl()` and hex values) and a **vertical** slider for the depth variable (maximum at the top, matching the ceiling). The swatch and the grid behind update live while dragging.
- **Closing:** a Done button, tapping the ceiling again, or turning the cube collapses it.
- **Not zoomed.** The ceiling and the vertical slider always span the depth variable's full range, whatever the zoom level. They are the coarse control; fine-tuning a variable means turning the cube so it lies on a grid axis and zooming there.

## Zoom (fine-tuning)

- **Patches keep a fixed, comfortably clickable size** (prototype: 48 px, at least the 44 px touch-target minimum). The grid never shrinks patches to show more colors; instead it shows a fixed number of them (prototype: 5 columns × 7 rows).
- **Zoom levels.** Levels are numbered _z_ = 0…4 and shown as 2^_z_: **1×, 2×, 4×, 8×, 16×**. At level _z_ an axis covers 1/2^_z_ of its variable's full range, so 1× always shows the whole range.
- **Each level has fixed patch values.** An axis with _n_ patches at level _z_ uses the values that are whole multiples of a step:
  - Saturation and Lightness: step = 100% / ((_n_ − 1) · 2^_z_). At 1× the patches run from exactly 0% to 100% (5 columns: 0, 25, 50, 75, 100).
  - Hue: step = 360° / (_n_ · 2^_z_), wrapping around. At 1× that is 72° apart on the 5-column x-axis and about 51° on the 7-row y-axis.
- **Zoom centers on the selected color.** The visible window is the _n_ consecutive values centered on the value nearest the selection. For Saturation and Lightness the window shifts to stay inside 0–100%; because _n_ steps always fit, every patch is a real, pickable color. Hue wraps instead of shifting.
- **Picking snaps to the patch.** Clicking a patch sets the selection to exactly that patch's color. After zooming out, a selection picked at a finer level usually lies between the coarser values; the nearest patch then shows the dashed ring (see [The picker face](#the-picker-face)) until the user picks again.
- **Zoom is shared across faces.** The zoom level applies to the grid axes of every face, so turning while zoomed shows the new face at the same zoomed scope, and the peek strips preview the neighbours at that scope too. The ceiling stays full-range (see [The ceiling](#the-ceiling-slider)).
- **Controls:**
  - Desktop: **double-click** a patch to select it and zoom in; **Alt/Option + double-click** zooms out. **Shift + scroll** zooms in/out (scroll without Shift turns the cube). macOS reports Shift + scroll as horizontal deltas; both must work.
  - All devices: a visible **− / level / +** control under the grid.
- **Values are continuous.** Because zoomed-in patches fall between coarse steps, H/S/L are not limited to a fixed palette. They are stored and displayed rounded to 0.1 (see [Callback value](#screens-and-flow)).

## Accessibility and motion

- All controls are real buttons and inputs, reachable by keyboard: the patch grid, peek strips (labelled with the turn they perform), ceiling (with `aria-expanded`), zoom buttons, the vertical slider (with `aria-valuetext`).
- **The patch grid is one single-choice control**, not 35 separate buttons: it is a single Tab stop, arrow keys move the selection between patches (stopping at the grid edges), and the selected patch is announced as checked. Each patch is labelled with its `hsl()` value. The exact ARIA pattern (radio group or grid) is a design-spec decision.
- Text on colored surfaces (the confirm button, the swatch) chooses dark or light ink by contrast.
- Turn, drop and zoom animations are disabled under `prefers-reduced-motion`.
- Gestures always have a non-gesture equivalent (peek strips, zoom buttons, ceiling button).

## Visual direction

A neutral, quiet gray UI so the picked colors are the only saturated things on screen (prototype: IBM Plex Sans + IBM Plex Mono, warm grays). Phone-first (390 × 844 in the mock-up); desktop adds mouse and wheel input, not a different layout.

## Decisions made

| Decision        | Choice                                                          | Why                                                                                                                                                                                                                                                                                                         |
| --------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Turn rule       | Horizontal keeps y, vertical keeps x                            | The axis across the swipe (perpendicular to it) stays put, and the six faces form one simple loop. Deliberately _not_ a physical cube: opposite swipes do the same swap and axes never flip, so every face reads ascending left→right and bottom→top. The earlier sketch used a different rule (see below). |
| Number of faces | All six                                                         | Falls out of the turn rule; restricting to three would break it.                                                                                                                                                                                                                                            |
| Patch size      | Fixed; zoom instead of shrinking                                | Patches must stay easy to click.                                                                                                                                                                                                                                                                            |
| Value model     | Continuous, stored and returned at 0.1 precision                | Zoom needs values between coarse steps; one precision keeps display and callback in sync.                                                                                                                                                                                                                   |
| Grid anchoring  | Fixed values per zoom level, window centered near the selection | 1× always shows the full range, including 0% and 100%; every patch is pickable. A finer selection is marked with a dashed ring on the nearest patch.                                                                                                                                                        |
| Slider range    | Always full range, not zoomed                                   | It is the coarse control; zoom fine-tunes the grid axes.                                                                                                                                                                                                                                                    |
| Peek strips     | Preview the depth variable's window ends at the current zoom    | Matches the prototype; gives each strip of a pair distinct content although both lead to the same face.                                                                                                                                                                                                     |
| Slider form     | Perspective "ceiling", expands to swatch + vertical slider      | Shows the depth axis as part of the cube; vertical slider keeps the same orientation.                                                                                                                                                                                                                       |

## Open questions

- **Pinch-to-zoom on touch devices** — expected, but not in the mock-up yet. How does it coexist with swipe-to-turn?
- **Opposite swipe directions** — they currently perform the same swap, so two left swipes return to the start. Should they instead keep rotating like a real cube (which would also flip axis directions)?
- **Coarse hue at 1×** — adjacent hues are 72° apart on the x-axis (about 51° on the y-axis) until you zoom. Is that acceptable, or should the zoom-out level differ per variable?
- **Keyboard turning** — is there a key binding for turning the cube (beyond tabbing to the peek strips), and how does it avoid clashing with the slider's arrow keys?
- **Persistence** — should the palette survive a reload (e.g. `localStorage`)?
- **Desktop layout** — is the phone layout centered on desktop enough, or does desktop get a wider grid?

## Sketches

- [`sketches/cube-faces.webp`](sketches/cube-faces.webp) — the original layout of faces connected by turns. Its axis labels follow an earlier rule (sideways keeps Hue on x); the rule was corrected to [Turning the cube](#turning-the-cube) above.
- [`sketches/ceiling-slider.png`](sketches/ceiling-slider.png) — the ceiling gradient dropping down into a selected-color swatch with a vertical slider.

The interactive mock-up predates some decisions here: it anchors the grid on the selection (showing dashed empty "wall" cells at range ends) and gives each patch its own Tab stop. Where they differ, this document wins.
