import { type Hsl, roundHsl } from "../color/hsl";
import {
  type AxisLattice,
  axisStep,
  edgeRelay,
  layLattice,
  onLattice,
  windowCenter,
  type ZoomLevel,
} from "./axis";
import { axisOf, type Face, START_FACE, turn, type TurnDirection } from "./cube";
import { type FaceLattice, GRID_SIZE, layFaceLattice } from "./face";

export type PickerState = {
  face: Face;
  /** Always rounded, and always a patch: on both stored lattices. */
  selection: Hsl;
  /** Each grid axis's patch lattice (spec §3.4); laid from the selection on turn and zoom. */
  lattice: FaceLattice;
  /** Grid window center (spec §3.4); reset to the selection on turn and zoom. */
  center: Hsl;
  zoom: ZoomLevel;
  /** Ceiling panel open. */
  expanded: boolean;
};

export type PickerAction =
  | { type: "pick"; color: Hsl } // patch click / keyboard
  | { type: "reachEnd"; after: PickerState } // edge rule once the double-click interval passes
  | { type: "setDepth"; value: number } // depth slider
  | { type: "turn"; direction: TurnDirection } // drag, wheel, peek strip, keyboard
  | { type: "zoom"; delta: 1 | -1 } // buttons, dblclick, pinch, Shift/Ctrl+wheel, keyboard
  | { type: "toggleExpanded" } // ceiling click or drag, Done
  | { type: "move"; dx: -1 | 0 | 1; dy: -1 | 0 | 1 }; // arrow keys in the grid

type GridAxis = keyof FaceLattice;

const DEFAULT_COLOR: Hsl = { h: 210, s: 64, l: 56 };

const GRID_AXES: GridAxis[] = ["x", "y"];

/** `face` at `zoom` laid out afresh: the lattice from the selection, centered on it. */
const laidOut = (selection: Hsl, face: Face, zoom: ZoomLevel) => ({
  face,
  zoom,
  selection,
  lattice: layFaceLattice(face, selection, zoom),
  center: selection,
});

/**
 * Whether the edge rule would see the same grid in both: face, zoom, and each grid axis's lattice,
 * center and selected value. Compared by value, since `view()` builds a new object on every read
 * (spec §4.1); the depth and the panel don't matter.
 */
const sameGrid = (a: PickerState, b: PickerState): boolean =>
  a.face.depth === b.face.depth &&
  a.zoom === b.zoom &&
  GRID_AXES.every((axis) => {
    const variable = a.face[axis];
    return (
      variable === b.face[axis] &&
      a.lattice[axis].origin === b.lattice[axis].origin &&
      a.lattice[axis].step === b.lattice[axis].step &&
      a.center[variable] === b.center[variable] &&
      a.selection[variable] === b.selection[variable]
    );
  });

/** `state` with one grid axis's lattice and window center set; unchanged parts stay the same objects. */
const withAxis = (
  state: PickerState,
  axis: GridAxis,
  lattice: AxisLattice,
  center: number,
): PickerState => {
  const variable = state.face[axis];
  const sameLattice = lattice === state.lattice[axis];
  const sameCenter = center === state.center[variable];
  if (sameLattice && sameCenter) return state;
  return {
    ...state,
    lattice: sameLattice ? state.lattice : { ...state.lattice, [axis]: lattice },
    center: sameCenter ? state.center : { ...state.center, [variable]: center },
  };
};

/** START_FACE, zoom 0, collapsed; the initial color rounded, the lattice laid and centered on it. */
export const initialPickerState = (initial?: Hsl): PickerState => ({
  ...laidOut(roundHsl(initial ?? DEFAULT_COLOR), START_FACE, 0),
  expanded: false,
});

/**
 * Makes each grid axis hold the selection: re-lays an axis whose stored lattice doesn't, centered on
 * the selection, and stores the center the window actually uses on the others, so the next pick
 * doesn't move the grid. A parent's controlled `value` goes through this in `view()` (spec §4.1).
 * Returns the same object when nothing changes.
 */
export const syncLattice = (state: PickerState): PickerState =>
  GRID_AXES.reduce((next, axis) => {
    const variable = state.face[axis];
    const n = GRID_SIZE[axis];
    const value = state.selection[variable];
    const stored = state.lattice[axis];
    return onLattice(variable, stored, value)
      ? withAxis(
          next,
          axis,
          stored,
          windowCenter(variable, n, stored, state.center[variable], value),
        )
      : withAxis(next, axis, layLattice(variable, n, state.zoom, value), value);
  }, state);

/** The edge rule on both axes (spec §3.4); the same object when it applies to neither. */
const reachEnd = (state: PickerState): PickerState =>
  GRID_AXES.reduce((next, axis) => {
    const variable = state.face[axis];
    const relay = edgeRelay(
      variable,
      GRID_SIZE[axis],
      state.zoom,
      state.lattice[axis],
      state.center[variable],
      state.selection[variable],
    );
    return relay ? withAxis(next, axis, relay.lattice, relay.center) : next;
  }, state);

/** Arrow keys: one patch per axis, scrolling at the window's edge; the same object if both stop. */
const move = (state: PickerState, dx: -1 | 0 | 1, dy: -1 | 0 | 1): PickerState =>
  GRID_AXES.reduce((next, axis) => {
    const d = axis === "x" ? dx : dy;
    if (d === 0) return next;
    const variable = state.face[axis];
    const step = axisStep(
      variable,
      GRID_SIZE[axis],
      state.zoom,
      state.lattice[axis],
      state.center[variable],
      state.selection[variable],
      d,
    );
    if (!step) return next;
    // axisStep's value is already stored-rounded.
    const moved = { ...next, selection: { ...next.selection, [variable]: step.value } };
    return withAxis(moved, axis, step.lattice, step.center);
  }, state);

export const pickerReducer = (state: PickerState, action: PickerAction): PickerState => {
  switch (action.type) {
    case "pick":
      // A patch is on the lattice, so this never moves the grid (spec §3.4); anything else is
      // re-laid so the selection stays a patch.
      return syncLattice({ ...state, selection: roundHsl(action.color) });
    case "reachEnd":
      // Only on the grid the pick left: a timer outliving a turn, zoom, move or other pick does nothing.
      return sameGrid(state, action.after) ? reachEnd(state) : state;
    case "setDepth":
      // The depth variable is on neither grid axis, so the lattices stay.
      return {
        ...state,
        selection: roundHsl({ ...state.selection, [state.face.depth]: action.value }),
      };
    case "turn":
      return {
        ...state,
        ...laidOut(state.selection, turn(state.face, axisOf(action.direction)), state.zoom),
        expanded: false,
      };
    case "zoom": {
      const zoom = Math.min(4, Math.max(0, state.zoom + action.delta)) as ZoomLevel;
      // A no-op zoom returns the same state object, so no transition starts; the layout resets
      // only when the zoom actually changes.
      if (zoom === state.zoom) return state;
      return { ...state, ...laidOut(state.selection, state.face, zoom) };
    }
    case "toggleExpanded":
      return { ...state, expanded: !state.expanded };
    case "move":
      return move(state, action.dx, action.dy);
  }
};
