import { describe, expect, it } from "vite-plus/test";
import { type Hsl, roundHsl } from "../color/hsl";
import { type Face, START_FACE, turn, type Variable } from "./cube";
import {
  ceilingStops,
  faceColors,
  faceLayout,
  faceVars,
  GRID_COLUMNS,
  layFaceLattice,
  GRID_ROWS,
  patchBackground,
  patchColor,
  peekStrips,
} from "./face";
import { axisWindow, laidWindow, layLattice, type ZoomLevel } from "./axis";

const ALL_FACES: Face[] = [
  { depth: "l", x: "h", y: "s" },
  { depth: "l", x: "s", y: "h" },
  { depth: "s", x: "h", y: "l" },
  { depth: "s", x: "l", y: "h" },
  { depth: "h", x: "s", y: "l" },
  { depth: "h", x: "l", y: "s" },
];
const ZOOMS: ZoomLevel[] = [0, 1, 2, 3, 4];
const SELECTIONS: Hsl[] = [
  { h: 210, s: 64, l: 56 },
  { h: 212.1, s: 18.8, l: 56.3 },
  { h: 0, s: 0, l: 0 },
  { h: 359.9, s: 100, l: 100 },
  { h: 350, s: 0, l: 100 },
  { h: 5, s: 100, l: 0 },
  { h: 179.9, s: 50, l: 0.1 },
];

const withVar = (base: Hsl, v: Variable, value: number): Hsl => ({ ...base, [v]: value });

// Independent of faceLayout: each patch's color straight from the two axis windows.
const referenceGrid = (face: Face, center: Hsl, sel: Hsl, zoom: ZoomLevel): Hsl[][] => {
  const lx = layLattice(face.x, GRID_COLUMNS, zoom, sel[face.x]);
  const ly = layLattice(face.y, GRID_ROWS, zoom, sel[face.y]);
  const wx = axisWindow(face.x, GRID_COLUMNS, lx, center[face.x], sel[face.x]);
  const wy = axisWindow(face.y, GRID_ROWS, ly, center[face.y], sel[face.y]);
  return Array.from({ length: GRID_ROWS }, (_, row) =>
    Array.from({ length: GRID_COLUMNS }, (_, col) =>
      roundHsl(
        withVar(withVar(sel, face.x, wx.values[col]), face.y, wy.values[GRID_ROWS - 1 - row]),
      ),
    ),
  );
};

// The face as a turn or zoom lays it: the lattice from the selection, the window around `center`.
const layout = (face: Face, center: Hsl, sel: Hsl, zoom: ZoomLevel) =>
  faceLayout(face, layFaceLattice(face, sel, zoom), center, sel);

// Every case runs with the window centered on the selection and with a center a few patches
// away, so nothing may quietly assume the two are the same.
const CENTER_OFFSETS: (Hsl | null)[] = [null, { h: 40, s: -12, l: 18 }];
const centerFor = (sel: Hsl, offset: Hsl | null): Hsl =>
  offset === null
    ? sel
    : roundHsl({ h: sel.h + offset.h, s: sel.s + offset.s, l: sel.l + offset.l });

const cases = ALL_FACES.flatMap((face) =>
  ZOOMS.flatMap((zoom) =>
    SELECTIONS.flatMap((sel) =>
      CENTER_OFFSETS.map((offset) => [face, zoom, sel, centerFor(sel, offset)] as const),
    ),
  ),
);
const name = "face %j, zoom %d, selection %j, center %j";

describe("faceLayout + patchColor", () => {
  it.each(cases)(`${name}: matches the reference grid at every cell`, (face, zoom, sel, center) => {
    const { params } = layout(face, center, sel, zoom);
    const ref = referenceGrid(face, center, sel, zoom);
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLUMNS; col++) {
        expect(patchColor(params, col, row)).toEqual(ref[row][col]);
      }
    }
  });

  it("puts the y maximum on the top row and the depth constant", () => {
    // S 50 is on the nominal 7-row grid, so the rows run from 100 down to 0
    const { params } = layout(START_FACE, { h: 210, s: 50, l: 56 }, { h: 210, s: 50, l: 56 }, 0);
    expect(patchColor(params, 0, 0).s).toBe(100);
    expect(patchColor(params, 0, GRID_ROWS - 1).s).toBe(0);
    expect(params.l).toEqual({ base: 56, perCol: 0, perRow: 0 });
  });

  it("leaves hue bases unnormalized", () => {
    // x: zoom 3, step 9 through 5, window from 5 − 2 · 9; y: hue on rows with the top row past 360
    expect(
      layout(START_FACE, { h: 5, s: 50, l: 50 }, { h: 5, s: 50, l: 50 }, 3).params.h.base,
    ).toBe(-13);
    const onY = layout(
      { depth: "l", x: "s", y: "h" },
      { h: 355, s: 50, l: 50 },
      { h: 355, s: 50, l: 50 },
      3,
    ).params.h;
    expect(onY.base).toBeGreaterThanOrEqual(360);
    expect(onY.perRow).toBeLessThan(0);
  });
});

describe("faceLayout: a center apart from the selection", () => {
  const sel = { h: 210, s: 64, l: 56 };
  // S on x at zoom 2: 0 is out of reach from 64, so the lattice runs from 100 in steps of 6
  const face: Face = { depth: "h", x: "s", y: "l" };

  it("lays the grid out around the center, with the selection mark on the selection", () => {
    const { params, mark } = layout(face, { ...sel, s: 52 }, sel, 2);
    expect(params.s.base).toBe(40); // 40, 46, 52, 58, 64
    expect(mark.col).toBe(4);
  });

  it("re-centers when the selection is outside the window", () => {
    const { params, mark } = layout(face, { ...sel, s: 20 }, sel, 2);
    expect(params.s.base).toBe(52); // centered on 64: 52 … 76
    expect(mark.col).toBe(2);
  });

  it("re-centers when the selection is below the window, keeping the mark on the grid", () => {
    // center 90: the window is 76 … 100, and 64 is below it
    const { params, mark } = layout(face, { ...sel, s: 90 }, sel, 2);
    expect(params.s.base).toBe(52);
    expect(mark.col).toBe(2);
  });

  it("keeps the selection on an edge patch when the center sits above it", () => {
    const { params, mark } = layout(face, { ...sel, s: 76 }, sel, 2);
    expect(params.s.base).toBe(64);
    expect(mark.col).toBe(0);
  });

  it("uses the stored lattice, not one laid from the current selection", () => {
    // laid from S 64 at 1× (0, 21.3, 42.7, 64, 85.3); then 21.3 is picked
    const lattice = {
      x: layLattice("s", GRID_COLUMNS, 0, 64),
      y: layLattice("l", GRID_ROWS, 0, 56),
    };
    const picked = { ...sel, s: 21.3 };
    const before = layout(face, sel, sel, 0);
    const after = faceLayout(face, lattice, sel, picked);
    expect(after.params).toEqual(before.params);
    expect(after.mark.col).toBe(1);
    expect(patchColor(after.params, after.mark.col, after.mark.row)).toEqual(picked);
  });
});

describe("faceLayout: selection mark", () => {
  it("is at the selection's column and row", () => {
    // zoom 0: hue runs through 216 (column 2 of 5); saturation 50 is the middle row of 7
    const { mark } = layout(START_FACE, { h: 216, s: 50, l: 56 }, { h: 216, s: 50, l: 56 }, 0);
    expect(mark).toEqual({ col: 2, row: 3 });
  });

  it("sits on the top row for S 100 and the bottom row for S 0", () => {
    expect(
      layout(START_FACE, { h: 216, s: 100, l: 56 }, { h: 216, s: 100, l: 56 }, 0).mark.row,
    ).toBe(0);
    expect(layout(START_FACE, { h: 216, s: 0, l: 56 }, { h: 216, s: 0, l: 56 }, 0).mark.row).toBe(
      GRID_ROWS - 1,
    );
  });

  it("is still on the selection after zooming out from a fine pick", () => {
    // S on x: 56.3, picked at zoom 4, is a patch again once zoom 0 lays the lattice from it
    const face: Face = { depth: "l", x: "s", y: "h" };
    const fine = { h: 0, s: 56.3, l: 56 };
    for (const zoom of [4, 0] as const) {
      const { params, mark } = layout(face, fine, fine, zoom);
      expect(patchColor(params, mark.col, mark.row)).toEqual(fine);
    }
  });

  it.each(cases)(
    `${name}: the marked patch's color is the selection`,
    (face, zoom, sel, center) => {
      const { params, mark } = layout(face, center, sel, zoom);
      expect(patchColor(params, mark.col, mark.row)).toEqual(sel);
    },
  );
});

describe("faceColors", () => {
  it("lists every patch color, top row first", () => {
    const sel = { h: 210, s: 64, l: 56 };
    const { params } = layout(START_FACE, sel, sel, 1);
    expect(faceColors(params)).toEqual(referenceGrid(START_FACE, sel, sel, 1).flat());
  });
});

describe("peekStrips", () => {
  it.each(cases)(`${name}: each strip matches its axisWindow definition`, (face, zoom, sel) => {
    // strips ignore the stored lattice and `center`: they use the windows a turn would lay
    const strips = peekStrips(face, sel, zoom);
    const depthX = laidWindow(face.depth, GRID_COLUMNS, zoom, sel[face.depth]).values;
    const depthY = laidWindow(face.depth, GRID_ROWS, zoom, sel[face.depth]).values;
    const ys = laidWindow(face.y, GRID_ROWS, zoom, sel[face.y]).values;
    const xs = laidWindow(face.x, GRID_COLUMNS, zoom, sel[face.x]).values;
    const cell = (depth: number, v: Variable, value: number) =>
      roundHsl(withVar(withVar(sel, face.depth, depth), v, value));
    for (let row = 0; row < GRID_ROWS; row++) {
      const y = ys[GRID_ROWS - 1 - row];
      expect(patchColor(strips.left, 0, row)).toEqual(cell(depthX[0], face.y, y));
      expect(patchColor(strips.right, 0, row)).toEqual(cell(depthX[GRID_COLUMNS - 1], face.y, y));
    }
    for (let col = 0; col < GRID_COLUMNS; col++) {
      expect(patchColor(strips.top, col, 0)).toEqual(cell(depthY[GRID_ROWS - 1], face.x, xs[col]));
      expect(patchColor(strips.bottom, col, 0)).toEqual(cell(depthY[0], face.x, xs[col]));
    }
  });

  it.each(cases)(`${name}: strips match the edges of the face a turn shows`, (face, zoom, sel) => {
    const strips = peekStrips(face, sel, zoom);
    // a turn lays the lattice from the selection and re-centers on it
    const sideways = layout(turn(face, "horizontal"), sel, sel, zoom).params;
    const upright = layout(turn(face, "vertical"), sel, sel, zoom).params;
    for (let row = 0; row < GRID_ROWS; row++) {
      expect(patchColor(strips.left, 0, row)).toEqual(patchColor(sideways, 0, row));
      expect(patchColor(strips.right, 0, row)).toEqual(patchColor(sideways, GRID_COLUMNS - 1, row));
    }
    for (let col = 0; col < GRID_COLUMNS; col++) {
      expect(patchColor(strips.top, col, 0)).toEqual(patchColor(upright, col, 0));
      expect(patchColor(strips.bottom, col, 0)).toEqual(patchColor(upright, col, GRID_ROWS - 1));
    }
  });

  it("indexes side strips by row and edge strips by column", () => {
    const strips = peekStrips(START_FACE, { h: 210, s: 64, l: 56 }, 2);
    for (const v of ["h", "s", "l"] as const) {
      expect(strips.left[v].perCol).toBe(0);
      expect(strips.right[v].perCol).toBe(0);
      expect(strips.top[v].perRow).toBe(0);
      expect(strips.bottom[v].perRow).toBe(0);
    }
  });
});

describe("ceilingStops", () => {
  it("spans the depth range max first, other variables at the selection", () => {
    const stops = ceilingStops(START_FACE, { h: 210, s: 64, l: 56 });
    expect(stops).toHaveLength(13);
    expect(stops[0]).toEqual({ h: 210, s: 64, l: 100 });
    expect(stops[12]).toEqual({ h: 210, s: 64, l: 0 });
    expect(stops[6].l).toBe(50);
  });

  it("handles a single stop", () => {
    expect(ceilingStops(START_FACE, { h: 210, s: 64, l: 56 }, 1)).toEqual([
      { h: 210, s: 64, l: 100 },
    ]);
  });

  it("runs hue from 359.9 to 0", () => {
    const stops = ceilingStops({ depth: "h", x: "s", y: "l" }, { h: 210, s: 64, l: 56 }, 5);
    expect(stops.map((c) => c.h)).toEqual([359.9, 269.9, 180, 90, 0]);
  });
});

describe("faceVars", () => {
  // Across all six faces every slot is non-zero somewhere, so no two keys stay interchangeable
  it.each(ALL_FACES)("%j: maps every property to its own affine term", (face) => {
    const sel = { h: 210, s: 64, l: 56 };
    const { params } = layout(face, sel, sel, 2);
    expect(faceVars(params)).toEqual({
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
  });

  it("returns all nine properties, never a subset", () => {
    const vars = faceVars(
      layout(START_FACE, { h: 5, s: 64, l: 56 }, { h: 5, s: 64, l: 56 }, 3).params,
    );
    expect(Object.keys(vars).sort()).toEqual(
      ["h", "s", "l"].flatMap((v) => [`--${v}-base`, `--${v}-col`, `--${v}-row`]).sort(),
    );
    expect(vars).toMatchObject({ "--h-base": -13, "--h-col": 9, "--h-row": 0, "--l-base": 56 });
  });
});

describe("patchBackground", () => {
  it("writes the column and row in as literals", () => {
    expect(patchBackground(2, 3)).toMatchInlineSnapshot(
      `"hsl(calc(var(--h-base) + 2 * var(--h-col) + 3 * var(--h-row)) calc((var(--s-base) + 2 * var(--s-col) + 3 * var(--s-row)) * 1%) calc((var(--l-base) + 2 * var(--l-col) + 3 * var(--l-row)) * 1%))"`,
    );
  });
});
