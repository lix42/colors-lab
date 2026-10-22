import { describe, expect, it } from "vite-plus/test";
import { type Hsl, roundHsl } from "../color/hsl";
import { layLattice, onLattice, windowCenter, type ZoomLevel } from "./axis";
import { type Face, START_FACE } from "./cube";
import { faceLayout, GRID_COLUMNS, GRID_ROWS, GRID_SIZE, layFaceLattice, patchColor } from "./face";
import {
  initialPickerState,
  type PickerAction,
  pickerReducer,
  type PickerState,
  syncLattice,
} from "./state";

const ZOOMS: ZoomLevel[] = [0, 1, 2, 3, 4];

/** The state a turn or zoom leaves behind: `face` at `zoom`, laid from and centered on `selection`. */
const laidOut = (selection: Hsl, face: Face = START_FACE, zoom: ZoomLevel = 0): PickerState => ({
  ...initialPickerState(selection),
  face,
  zoom,
  lattice: layFaceLattice(face, selection, zoom),
});

/** S on x and L on y, so the S edge rule plays out on the 5 columns. */
const S_ON_X: Face = { depth: "h", x: "s", y: "l" };

/** START_FACE turned vertical: depth s, x h, y l — puts l on a grid axis. */
const L_ON_Y: Face = { depth: "s", x: "h", y: "l" };

/** The x values the grid shows, left to right. */
const columns = (state: PickerState): number[] => {
  const { params } = faceLayout(state.face, state.lattice, state.center, state.selection);
  return Array.from({ length: GRID_COLUMNS }, (_, col) => patchColor(params, col, 0)[state.face.x]);
};

const markOf = (state: PickerState) =>
  faceLayout(state.face, state.lattice, state.center, state.selection).mark;

/** The y values the grid shows, top to bottom. */
const rows = (state: PickerState): number[] => {
  const { params } = faceLayout(state.face, state.lattice, state.center, state.selection);
  return Array.from({ length: GRID_ROWS }, (_, row) => patchColor(params, 0, row)[state.face.y]);
};

/** Zoom 1, hue through 210 at 36° (window 138 … 282), then a host value of 354: on the lattice, off the window. */
const offWindow = (): PickerState => ({
  ...laidOut({ h: 210, s: 64, l: 56 }, START_FACE, 1),
  selection: { h: 354, s: 64, l: 56 },
});

describe("initialPickerState", () => {
  it("starts on START_FACE, zoom 0, collapsed, hsl(210 64% 56%), with the lattice laid", () => {
    // x: hue through 210 at 72°; y: S 64 from 0 in steps of 16 (0 … 96)
    expect(initialPickerState()).toEqual({
      face: START_FACE,
      selection: { h: 210, s: 64, l: 56 },
      lattice: { x: { origin: 210, step: 72 }, y: { origin: 0, step: 16 } },
      center: { h: 210, s: 64, l: 56 },
      zoom: 0,
      expanded: false,
    });
  });

  it("rounds the initial color and lays and centers the window on it", () => {
    const state = initialPickerState({ h: 359.96, s: 64.04, l: -3 });
    expect(state.selection).toEqual({ h: 0, s: 64, l: 0 });
    expect(state.center).toEqual(state.selection);
    expect(state.lattice).toEqual(layFaceLattice(START_FACE, state.selection, 0));
  });
});

describe("pick", () => {
  it("on a patch keeps the lattice and center, so the grid doesn't move", () => {
    const state = { ...initialPickerState(), zoom: 2 as ZoomLevel, expanded: true };
    const laid = { ...state, lattice: layFaceLattice(START_FACE, state.selection, 2) };
    const next = pickerReducer(laid, { type: "pick", color: { h: 228, s: 72, l: 56 } });
    expect(next.selection).toEqual({ h: 228, s: 72, l: 56 });
    expect(next.lattice).toBe(laid.lattice);
    expect(next.center).toBe(laid.center);
    expect(next.face).toBe(laid.face);
    expect(next.zoom).toBe(2);
    expect(next.expanded).toBe(true);
    expect(columns(next)).toEqual(columns(laid));
    expect(rows(next)).toEqual(rows(laid));
  });

  it("after a host value off the window, keeps the window that value shows", () => {
    const shown = syncLattice(offWindow());
    expect(columns(shown)).toEqual([282, 318, 354, 30, 66]);
    const next = pickerReducer(shown, { type: "pick", color: { h: 66, s: 64, l: 56 } });
    expect(columns(next)).toEqual([282, 318, 354, 30, 66]);
    expect(markOf(next).col).toBe(4);
  });

  it("stores roundHsl of the color, and re-lays an axis it isn't on", () => {
    const next = pickerReducer(initialPickerState(), {
      type: "pick",
      color: { h: 725.55, s: 100.04, l: 33.33 },
    });
    expect(next.selection).toEqual({ h: 5.6, s: 100, l: 33.3 });
    expect(onLattice("h", next.lattice.x, 5.6)).toBe(true);
    expect(onLattice("s", next.lattice.y, 100)).toBe(true);
    expect(next.center).toEqual({ h: 5.6, s: 100, l: 56 });
  });
});

describe("syncLattice", () => {
  it("returns the same object when the selection is on both lattices", () => {
    const state = initialPickerState();
    expect(syncLattice(state)).toBe(state);
  });

  it("stores the selection as the center when it's on the lattice but off the window", () => {
    const state = offWindow();
    const next = syncLattice(state);
    expect(next.lattice).toBe(state.lattice);
    expect(next.center).toEqual({ h: 354, s: 64, l: 56 });
  });

  it("re-lays and re-centers only the axis a host value isn't on", () => {
    const state = initialPickerState();
    // 48 is on the S lattice (0, 16, … 96); 100° isn't on the hue lattice through 210
    const next = syncLattice({ ...state, selection: { h: 100, s: 48, l: 56 } });
    expect(next.lattice.x).toEqual(layLattice("h", GRID_COLUMNS, 0, 100));
    expect(next.lattice.y).toBe(state.lattice.y);
    expect(next.center).toEqual({ h: 100, s: 64, l: 56 });
    expect(
      patchColor(
        faceLayout(next.face, next.lattice, next.center, next.selection).params,
        markOf(next).col,
        markOf(next).row,
      ),
    ).toEqual(next.selection);
  });
});

describe("reachEnd", () => {
  it("lays the lattice on the end just past a picked edge patch", () => {
    // S 64 on x at 1×: 0, 21.3, 42.7, 64, 85.3; pick the top patch, then the timer fires
    const picked = pickerReducer(laidOut({ h: 210, s: 64, l: 56 }, S_ON_X), {
      type: "pick",
      color: { h: 210, s: 85.3, l: 56 },
    });
    expect(columns(picked)).toEqual([0, 21.3, 42.7, 64, 85.3]);
    const next = pickerReducer(picked, { type: "reachEnd", after: picked });
    expect(next.lattice.x).toEqual({ origin: 100, step: 100 - 85.3 });
    expect(next.center.s).toBe(100);
    expect(columns(next)).toEqual([41.2, 55.9, 70.6, 85.3, 100]);
    expect(markOf(next).col).toBe(3);
  });

  it("returns the same object when the rule applies to neither axis", () => {
    const state = initialPickerState();
    expect(pickerReducer(state, { type: "reachEnd", after: state })).toBe(state);
  });

  it("does nothing once another action has changed the state", () => {
    // a turn puts L 85 on x at 1×, where the edge rule applies, but the timer belongs to the pick
    const picked = pickerReducer(initialPickerState(), {
      type: "pick",
      color: { h: 210, s: 64, l: 85 },
    });
    const turned = pickerReducer(picked, { type: "turn", direction: "left" });
    expect(turned.face.x).toBe("l");
    expect(pickerReducer(turned, { type: "reachEnd", after: turned })).not.toBe(turned);
    expect(pickerReducer(turned, { type: "reachEnd", after: picked })).toBe(turned);
  });

  it("fires on a copy of the picked state, as view() rebuilds it, and after a depth change", () => {
    const picked = pickerReducer(laidOut({ h: 210, s: 64, l: 56 }, S_ON_X), {
      type: "pick",
      color: { h: 210, s: 85.3, l: 56 },
    });
    const view = { ...picked, selection: { ...picked.selection } };
    expect(columns(pickerReducer(view, { type: "reachEnd", after: picked }))).toEqual([
      41.2, 55.9, 70.6, 85.3, 100,
    ]);
    const deeper = pickerReducer(picked, { type: "setDepth", value: 300 });
    expect(pickerReducer(deeper, { type: "reachEnd", after: picked }).center.s).toBe(100);
  });

  it("does nothing after another pick, a move or a zoom", () => {
    // each would take the edge rule with a fresh after, so only the guard stops it
    const start = laidOut({ h: 210, s: 64, l: 56 }, S_ON_X);
    const picked = pickerReducer(start, { type: "pick", color: { h: 210, s: 85.3, l: 56 } });
    const later = [
      pickerReducer(picked, { type: "pick", color: { h: 210, s: 85.3, l: 70 } }), // y value only
      pickerReducer(picked, { type: "move", dx: 0, dy: 1 }), // y only; x still on the edge patch
      { ...picked, zoom: 1 as ZoomLevel }, // the zoom alone (a real zoom also re-lays)
    ];
    for (const next of later) {
      expect(pickerReducer(next, { type: "reachEnd", after: next })).not.toBe(next);
      expect(pickerReducer(next, { type: "reachEnd", after: picked })).toBe(next);
    }
  });
});

describe("setDepth", () => {
  it("changes only the depth channel, rounded", () => {
    const next = pickerReducer(initialPickerState(), { type: "setDepth", value: 56.44999 });
    expect(next.selection).toEqual({ h: 210, s: 64, l: 56.4 });
  });

  it("clamps an s/l depth and wraps a hue depth", () => {
    const onL = pickerReducer(initialPickerState(), { type: "setDepth", value: 120 });
    expect(onL.selection.l).toBe(100);
    const clamped = pickerReducer(laidOut({ h: 210, s: 64, l: 56 }, L_ON_Y), {
      type: "setDepth",
      value: -0.04,
    });
    expect(clamped.selection).toEqual({ h: 210, s: 0, l: 56 });
    const wrapped = pickerReducer(laidOut({ h: 210, s: 64, l: 56 }, S_ON_X), {
      type: "setDepth",
      value: 359.96,
    });
    expect(wrapped.selection.h).toBe(0);
  });

  it("leaves the lattice and center alone", () => {
    const state = { ...initialPickerState(), center: { h: 100, s: 50, l: 25 } };
    const next = pickerReducer(state, { type: "setDepth", value: 80 });
    expect(next.center).toBe(state.center);
    expect(next.lattice).toBe(state.lattice);
  });
});

describe("turn", () => {
  it("horizontal swaps depth with x, vertical swaps depth with y", () => {
    const start = initialPickerState();
    for (const direction of ["left", "right"] as const) {
      expect(pickerReducer(start, { type: "turn", direction }).face).toEqual({
        depth: "h",
        x: "l",
        y: "s",
      });
    }
    for (const direction of ["up", "down"] as const) {
      expect(pickerReducer(start, { type: "turn", direction }).face).toEqual(L_ON_Y);
    }
  });

  it("twice on the same axis is identity", () => {
    const start = initialPickerState();
    const once = pickerReducer(start, { type: "turn", direction: "left" });
    expect(pickerReducer(once, { type: "turn", direction: "right" }).face).toEqual(START_FACE);
  });

  it("lays the new face's lattice, resets center to the selection and collapses the panel", () => {
    const state = {
      ...laidOut({ h: 288, s: 64, l: 56 }, START_FACE, 3),
      center: { h: 10, s: 20, l: 30 },
      expanded: true,
    };
    const next = pickerReducer(state, { type: "turn", direction: "up" });
    expect(next.lattice).toEqual(layFaceLattice(L_ON_Y, state.selection, 3));
    expect(next.center).toBe(state.selection);
    expect(next.expanded).toBe(false);
    expect(next.selection).toBe(state.selection);
    expect(next.zoom).toBe(3);
  });
});

describe("zoom", () => {
  it("steps within 0…4, re-lays the lattice and resets center to the selection", () => {
    const state = {
      ...laidOut({ h: 210, s: 64, l: 56 }, START_FACE, 2),
      center: { h: 10, s: 20, l: 30 },
    };
    const in_ = pickerReducer(state, { type: "zoom", delta: 1 });
    expect(in_.zoom).toBe(3);
    expect(in_.lattice).toEqual(layFaceLattice(START_FACE, state.selection, 3));
    expect(in_.center).toBe(state.selection);
    const out = pickerReducer(in_, { type: "zoom", delta: -1 });
    expect(out.zoom).toBe(2);
    expect(out.lattice).toEqual(layFaceLattice(START_FACE, state.selection, 2));
  });

  it.each(ZOOMS)("reaches level %i from 0 by repeated zoom-in", (level) => {
    let state = initialPickerState();
    for (let i = 0; i < level; i++) state = pickerReducer(state, { type: "zoom", delta: 1 });
    expect(state.zoom).toBe(level);
  });

  it("clamped at 0 or 4 returns the identical state object", () => {
    const at0 = { ...initialPickerState(), center: { h: 10, s: 20, l: 30 } };
    expect(pickerReducer(at0, { type: "zoom", delta: -1 })).toBe(at0);
    const at4 = {
      ...laidOut({ h: 210, s: 64, l: 56 }, START_FACE, 4),
      center: { h: 10, s: 20, l: 30 },
    };
    expect(pickerReducer(at4, { type: "zoom", delta: 1 })).toBe(at4);
  });
});

describe("toggleExpanded", () => {
  it("flips the panel and leaves the rest alone", () => {
    const state = initialPickerState();
    const open = pickerReducer(state, { type: "toggleExpanded" });
    expect(open).toEqual({ ...state, expanded: true });
    expect(pickerReducer(open, { type: "toggleExpanded" })).toEqual(state);
  });
});

describe("move", () => {
  // zoom 0 from the default: x hue 66, 138, 210, 282, 354; y S 0, 16, … 96
  it("steps one patch inside the window, keeping the lattice and center", () => {
    const state = initialPickerState();
    const next = pickerReducer(state, { type: "move", dx: 1, dy: 0 });
    expect(next.selection).toEqual({ h: 282, s: 64, l: 56 });
    expect(next.lattice).toBe(state.lattice);
    expect(next.center).toBe(state.center);
  });

  it("after a host value off the window, moves the mark instead of scrolling", () => {
    let state = syncLattice(offWindow());
    for (const [h, col] of [
      [30, 3],
      [66, 4],
    ] as const) {
      state = pickerReducer(state, { type: "move", dx: 1, dy: 0 });
      expect(state.selection.h).toBe(h);
      expect(markOf(state).col).toBe(col);
      expect(columns(state)).toEqual([282, 318, 354, 30, 66]);
    }
  });

  it("dy=+1 steps the y variable up one lattice step, and back", () => {
    const next = pickerReducer(initialPickerState(), { type: "move", dx: 0, dy: 1 });
    expect(next.selection.s).toBe(80);
    expect(pickerReducer(next, { type: "move", dx: 0, dy: -1 }).selection.s).toBe(64);
  });

  it("moves both axes on a diagonal", () => {
    const next = pickerReducer(initialPickerState(), { type: "move", dx: 1, dy: 1 });
    expect(next.selection).toEqual({ h: 282, s: 80, l: 56 });
  });

  it("scrolls the window one lattice step at the right edge, mark on the edge patch", () => {
    // zoom 1, hue through 210 at 36°: 138 … 282
    let state = laidOut({ h: 210, s: 64, l: 56 }, START_FACE, 1);
    state = pickerReducer(state, { type: "move", dx: 1, dy: 0 });
    state = pickerReducer(state, { type: "move", dx: 1, dy: 0 });
    expect(state.selection.h).toBe(282);
    expect(columns(state)).toEqual([138, 174, 210, 246, 282]);
    state = pickerReducer(state, { type: "move", dx: 1, dy: 0 });
    expect(state.selection.h).toBe(318);
    expect(columns(state)).toEqual([174, 210, 246, 282, 318]);
    expect(markOf(state).col).toBe(GRID_COLUMNS - 1);
  });

  it("wraps the hue across 0/360 scrolling right, and back", () => {
    let state = laidOut({ h: 210, s: 64, l: 56 }, START_FACE, 1);
    for (let i = 0; i < 5; i++) state = pickerReducer(state, { type: "move", dx: 1, dy: 0 });
    expect(state.selection.h).toBe(30);
    expect(columns(state)).toEqual([246, 282, 318, 354, 30]);
    expect(markOf(state).col).toBe(GRID_COLUMNS - 1);
    expect(pickerReducer(state, { type: "move", dx: -1, dy: 0 }).selection.h).toBe(354);
  });

  it("scrolls left across hue 0", () => {
    // zoom 1, hue through 10: 298, 334, 10, 46, 82
    let state = laidOut({ h: 10, s: 64, l: 56 }, START_FACE, 1);
    state = pickerReducer(state, { type: "move", dx: -1, dy: 0 });
    expect(state.selection.h).toBe(334);
    state = pickerReducer(state, { type: "move", dx: -1, dy: 0 });
    expect(state.selection.h).toBe(298);
    expect(markOf(state).col).toBe(0);
    state = pickerReducer(state, { type: "move", dx: -1, dy: 0 });
    expect(state.selection.h).toBe(262);
    expect(columns(state)).toEqual([262, 298, 334, 10, 46]);
    expect(markOf(state).col).toBe(0);
    expect(state.center.h).toBeGreaterThanOrEqual(0);
    expect(state.center.h).toBeLessThan(360);
  });

  it("scrolls down from a window pinned at S 100", () => {
    // zoom 1, S 100 on y: the lattice runs from 100 in steps of 8.33; the window is 50 … 100
    let state = laidOut({ h: 210, s: 100, l: 56 }, START_FACE, 1);
    for (const expected of [91.7, 83.3, 75, 66.7, 58.3, 50]) {
      state = pickerReducer(state, { type: "move", dx: 0, dy: -1 });
      expect(state.selection.s).toBe(expected);
    }
    expect(markOf(state).row).toBe(GRID_ROWS - 1);
    state = pickerReducer(state, { type: "move", dx: 0, dy: -1 });
    expect(state.selection.s).toBe(41.7);
    expect(markOf(state).row).toBe(GRID_ROWS - 1); // the window scrolled one step, not re-centered
  });

  it("scrolls up from a window pinned at S 0", () => {
    // zoom 1, S 0 on y: the lattice runs from 0 in steps of 8.33; the window is 0 … 50
    let state = laidOut({ h: 210, s: 0, l: 56 }, START_FACE, 1);
    for (const expected of [8.3, 16.7, 25, 33.3, 41.7, 50]) {
      state = pickerReducer(state, { type: "move", dx: 0, dy: 1 });
      expect(state.selection.s).toBe(expected);
    }
    expect(markOf(state).row).toBe(0);
    state = pickerReducer(state, { type: "move", dx: 0, dy: 1 });
    expect(state.selection.s).toBe(58.3);
    expect(markOf(state).row).toBe(0); // the window scrolled one step, not re-centered
  });

  it("reaches an end that isn't a patch from an edge patch the layout started on", () => {
    // S 90 on y at 1×: 0, 15, … 90, the selection on the top patch and 100 not a patch
    const state = initialPickerState({ h: 210, s: 90, l: 56 });
    expect(rows(state)[0]).toBe(90);
    const next = pickerReducer(state, { type: "move", dx: 0, dy: 1 });
    expect(next.selection.s).toBe(100);
    expect(rows(next)[0]).toBe(100);
    expect(markOf(next).row).toBe(0);
  });

  it("reaches a 0 that isn't a patch from the bottom edge patch", () => {
    // S 10 on y at 1×: 10, 25, … 100, the selection on the bottom patch and 0 not a patch
    const state = initialPickerState({ h: 210, s: 10, l: 56 });
    expect(rows(state)[GRID_ROWS - 1]).toBe(10);
    const next = pickerReducer(state, { type: "move", dx: 0, dy: -1 });
    expect(next.selection.s).toBe(0);
    expect(rows(next)[GRID_ROWS - 1]).toBe(0);
    expect(markOf(next).row).toBe(GRID_ROWS - 1);
  });

  it("stops s and l at 0 and 100, returning the same object when nothing can move", () => {
    const at100 = laidOut({ h: 210, s: 100, l: 56 });
    expect(pickerReducer(at100, { type: "move", dx: 0, dy: 1 })).toBe(at100);
    const at0 = laidOut({ h: 210, s: 0, l: 56 });
    expect(pickerReducer(at0, { type: "move", dx: 0, dy: -1 })).toBe(at0);
    const l100 = laidOut({ h: 210, s: 64, l: 100 }, L_ON_Y);
    expect(pickerReducer(l100, { type: "move", dx: 0, dy: 1 })).toBe(l100);
    const l0 = laidOut({ h: 210, s: 64, l: 0 }, L_ON_Y);
    expect(pickerReducer(l0, { type: "move", dx: 0, dy: -1 })).toBe(l0);
  });

  it("applies the edge rule at once when it lands on an edge patch near an end", () => {
    // S 64 on x at 1×: moving right onto 85.3 re-lays on 100
    const next = pickerReducer(laidOut({ h: 210, s: 64, l: 56 }, S_ON_X), {
      type: "move",
      dx: 1,
      dy: 0,
    });
    expect(next.selection.s).toBe(85.3);
    expect(columns(next)).toEqual([41.2, 55.9, 70.6, 85.3, 100]);
    expect(pickerReducer(next, { type: "move", dx: 1, dy: 0 }).selection.s).toBe(100);
  });

  it("doesn't re-lay on an end closer than half a nominal step", () => {
    // S 74.9 on x at 1×: 0, 25, 49.9, 74.9, 99.9; 100 is 0.1 past the edge
    const next = pickerReducer(laidOut({ h: 210, s: 74.9, l: 56 }, S_ON_X), {
      type: "move",
      dx: 1,
      dy: 0,
    });
    expect(next.selection.s).toBe(99.9);
    expect(columns(next)).toEqual([0, 25, 49.9, 74.9, 99.9]);
    expect(pickerReducer(next, { type: "move", dx: 1, dy: 0 })).toBe(next);
  });

  it("leaves face, zoom and the panel unchanged", () => {
    const state = { ...laidOut({ h: 210, s: 64, l: 56 }, START_FACE, 1), expanded: true };
    const next = pickerReducer(state, { type: "move", dx: 1, dy: 1 });
    expect(next.face).toBe(state.face);
    expect(next.zoom).toBe(1);
    expect(next.expanded).toBe(true);
  });
});

describe("invariants", () => {
  // A small deterministic generator, so a failing sequence can be replayed.
  const random = (seed: number) => () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const actionFrom = (r: () => number, state: PickerState): PickerAction => {
    const pick = Math.floor(r() * 10);
    const d = (): -1 | 0 | 1 => ([-1, 0, 1] as const)[Math.floor(r() * 3)];
    switch (pick) {
      case 0: {
        // a patch, as FaceGrid picks it
        const { params } = faceLayout(state.face, state.lattice, state.center, state.selection);
        const col = Math.floor(r() * GRID_COLUMNS);
        const row = Math.floor(r() * GRID_ROWS);
        return { type: "pick", color: patchColor(params, col, row) };
      }
      case 1:
        // usually right after the pick, sometimes a timer that outlived other actions
        return { type: "reachEnd", after: r() < 0.8 ? state : initialPickerState() };
      case 8:
        // a color that isn't a patch
        return { type: "pick", color: { h: r() * 360, s: r() * 100, l: r() * 100 } };
      case 2:
        return { type: "setDepth", value: r() * (state.face.depth === "h" ? 360 : 100) };
      case 3:
        return {
          type: "turn",
          direction: (["left", "right", "up", "down"] as const)[Math.floor(r() * 4)],
        };
      case 4:
        return { type: "zoom", delta: r() < 0.5 ? 1 : -1 };
      default:
        return { type: "move", dx: d(), dy: d() };
    }
  };

  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    "seed %i: the selection is always a stored, marked patch",
    (seed) => {
      const r = random(seed);
      let state = initialPickerState({ h: r() * 360, s: r() * 100, l: r() * 100 });
      for (let i = 0; i < 400; i++) {
        // now and then a host value, as view() shows it
        state =
          r() < 0.05
            ? syncLattice({
                ...state,
                selection: roundHsl({ h: r() * 360, s: r() * 100, l: r() * 100 }),
              })
            : pickerReducer(state, actionFrom(r, state));
        const { face, lattice, selection } = state;
        expect(selection).toEqual(roundHsl(selection));
        expect(onLattice(face.x, lattice.x, selection[face.x])).toBe(true);
        expect(onLattice(face.y, lattice.y, selection[face.y])).toBe(true);
        const { params, mark } = faceLayout(face, lattice, state.center, selection);
        expect(patchColor(params, mark.col, mark.row)).toEqual(selection);
        // the stored center is the one the window uses, so a pick never moves the grid
        for (const axis of ["x", "y"] as const) {
          const v = face[axis];
          expect(
            windowCenter(v, GRID_SIZE[axis], lattice[axis], state.center[v], selection[v]),
          ).toBe(state.center[v]);
        }
      }
    },
  );
});
