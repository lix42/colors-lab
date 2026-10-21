import { type Hsl, roundHsl } from "../color/hsl";
import { type Face, type Variable, VARIABLES } from "./cube";
import { type AxisWindow, axisWindow, type ZoomLevel } from "./lattice";

export const GRID_COLUMNS = 5;
export const GRID_ROWS = 7;

/** value = base + col · perCol + row · perRow */
export type Affine = { base: number; perCol: number; perRow: number };
export type FaceParams = Record<Variable, Affine>;
export type Ring = { col: number; row: number; kind: "exact" | "approx" };
export type PeekSide = "left" | "right" | "top" | "bottom";

const constant = (base: number): Affine => ({ base, perCol: 0, perRow: 0 });

// x grows with the column from the window's first value.
const alongColumns = (w: AxisWindow): Affine => ({ base: w.first, perCol: w.step, perRow: 0 });

// y shrinks with the row: row 0 is the window's maximum.
const alongRows = (w: AxisWindow): Affine => ({
  base: w.first + (GRID_ROWS - 1) * w.step,
  perCol: 0,
  perRow: -w.step,
});

const onFace = (face: Face, parts: Record<keyof Face, Affine>): FaceParams => {
  const params = {} as FaceParams;
  for (const role of ["depth", "x", "y"] as const) params[face[role]] = parts[role];
  return params;
};

/**
 * The face as nine numbers (bases never normalized: a hue base on x can be negative, one on y
 * can reach 360 or more) plus where the ring sits. Both windows center on the selection.
 */
export const faceLayout = (
  face: Face,
  selection: Hsl,
  zoom: ZoomLevel,
): { params: FaceParams; ring: Ring } => {
  const wx = axisWindow(face.x, GRID_COLUMNS, zoom, selection[face.x]);
  const wy = axisWindow(face.y, GRID_ROWS, zoom, selection[face.y]);
  return {
    params: onFace(face, {
      depth: constant(selection[face.depth]),
      x: alongColumns(wx),
      y: alongRows(wy),
    }),
    ring: {
      col: wx.nearest,
      row: GRID_ROWS - 1 - wy.nearest,
      kind: wx.exact && wy.exact ? "exact" : "approx",
    },
  };
};

const at = (a: Affine, col: number, row: number): number =>
  a.base + col * a.perCol + row * a.perRow;

/** One patch's color: the lattice value a pick there stores. */
export const patchColor = (params: FaceParams, col: number, row: number): Hsl =>
  roundHsl({ h: at(params.h, col, row), s: at(params.s, col, row), l: at(params.l, col, row) });

/** All GRID_ROWS × GRID_COLUMNS patch colors, top row first; `screenScheme`'s input, not for rendering. */
export const faceColors = (params: FaceParams): Hsl[] =>
  Array.from({ length: GRID_ROWS * GRID_COLUMNS }, (_, i) =>
    patchColor(params, i % GRID_COLUMNS, Math.floor(i / GRID_COLUMNS)),
  );

/**
 * The edge of the face each turn would show, from windows centered on the selection (a turn
 * re-centers). Left/right cells are indexed by row, top/bottom cells by column.
 */
export const peekStrips = (
  face: Face,
  selection: Hsl,
  zoom: ZoomLevel,
): Record<PeekSide, FaceParams> => {
  const windowOf = (variable: Variable, n: number) =>
    axisWindow(variable, n, zoom, selection[variable]);

  const depthOnX = windowOf(face.depth, GRID_COLUMNS);
  const y = alongRows(windowOf(face.y, GRID_ROWS));
  const sideStrip = (depth: number) =>
    onFace(face, { depth: constant(depth), x: constant(selection[face.x]), y });

  const depthOnY = windowOf(face.depth, GRID_ROWS);
  const x = alongColumns(windowOf(face.x, GRID_COLUMNS));
  const edgeStrip = (depth: number) =>
    onFace(face, { depth: constant(depth), x, y: constant(selection[face.y]) });

  return {
    left: sideStrip(depthOnX.first),
    right: sideStrip(depthOnX.first + (GRID_COLUMNS - 1) * depthOnX.step),
    top: edgeStrip(depthOnY.first + (GRID_ROWS - 1) * depthOnY.step),
    bottom: edgeStrip(depthOnY.first),
  };
};

/** `count` evenly spaced depth values over the full range, max first (hue: 359.9 to 0). */
export const ceilingStops = (face: Face, selection: Hsl, count = 13): Hsl[] => {
  const max = VARIABLES[face.depth].wraps ? 359.9 : VARIABLES[face.depth].max;
  return Array.from({ length: count }, (_, i) =>
    roundHsl({
      ...selection,
      [face.depth]: count === 1 ? max : (max * (count - 1 - i)) / (count - 1),
    }),
  );
};

type FaceVar = `--${Variable}-${"base" | "col" | "row"}`;

/** All nine custom properties CSS computes the patch colors from; missing one blanks every patch. */
export const faceVars = (params: FaceParams): Record<FaceVar, number> => ({
  "--h-base": params.h.base,
  "--h-col": params.h.perCol,
  "--h-row": params.h.perRow,
  "--s-base": params.s.base,
  "--s-col": params.s.perCol,
  "--s-row": params.s.perRow,
  "--l-base": params.l.base,
  "--l-col": params.l.perCol,
  "--l-row": params.l.perRow,
});

const term = (v: Variable, col: number, row: number) =>
  `var(--${v}-base) + ${col} * var(--${v}-col) + ${row} * var(--${v}-row)`;

/**
 * The patch's `background`, with its column and row as literals; reads the `faceVars` properties
 * from an ancestor. CSS wraps the hue, so unnormalized bases paint correctly.
 */
export const patchBackground = (col: number, row: number): string =>
  `hsl(calc(${term("h", col, row)}) calc((${term("s", col, row)}) * 1%) calc((${term("l", col, row)}) * 1%))`;
