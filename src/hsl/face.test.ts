import { describe, expect, it } from "vite-plus/test";
import { type Hsl, roundHsl } from "../color/hsl";
import { type Face, START_FACE, turn, type Variable } from "./cube";
import {
  ceilingStops,
  faceColors,
  faceLayout,
  faceVars,
  GRID_COLUMNS,
  GRID_ROWS,
  patchBackground,
  patchColor,
  peekStrips,
} from "./face";
import { axisWindow, type ZoomLevel } from "./lattice";

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
const referenceGrid = (face: Face, sel: Hsl, zoom: ZoomLevel): Hsl[][] => {
  const wx = axisWindow(face.x, GRID_COLUMNS, zoom, sel[face.x]);
  const wy = axisWindow(face.y, GRID_ROWS, zoom, sel[face.y]);
  return Array.from({ length: GRID_ROWS }, (_, row) =>
    Array.from({ length: GRID_COLUMNS }, (_, col) =>
      roundHsl(
        withVar(withVar(sel, face.x, wx.values[col]), face.y, wy.values[GRID_ROWS - 1 - row]),
      ),
    ),
  );
};

const cases = ALL_FACES.flatMap((face) =>
  ZOOMS.flatMap((zoom) => SELECTIONS.map((sel) => [face, zoom, sel] as const)),
);
const name = "face %j, zoom %d, selection %j";

describe("faceLayout + patchColor", () => {
  it.each(cases)(`${name}: matches the reference grid at every cell`, (face, zoom, sel) => {
    const { params } = faceLayout(face, sel, zoom);
    const ref = referenceGrid(face, sel, zoom);
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLUMNS; col++) {
        expect(patchColor(params, col, row)).toEqual(ref[row][col]);
      }
    }
  });

  it("puts the y maximum on the top row and the depth constant", () => {
    const { params } = faceLayout(START_FACE, { h: 210, s: 64, l: 56 }, 0);
    expect(patchColor(params, 0, 0).s).toBe(100);
    expect(patchColor(params, 0, GRID_ROWS - 1).s).toBe(0);
    expect(params.l).toEqual({ base: 56, perCol: 0, perRow: 0 });
  });

  it("leaves hue bases unnormalized", () => {
    // x: zoom 3, step 9, window from -9; y: hue on rows with the top row past 360
    expect(faceLayout(START_FACE, { h: 5, s: 50, l: 50 }, 3).params.h.base).toBe(-9);
    const onY = faceLayout({ depth: "l", x: "s", y: "h" }, { h: 355, s: 50, l: 50 }, 3).params.h;
    expect(onY.base).toBeGreaterThanOrEqual(360);
    expect(onY.perRow).toBeLessThan(0);
  });
});

describe("faceLayout: ring", () => {
  it("is exact on a lattice selection, at the nearest column and row", () => {
    // zoom 0: hue 216 is column 2 (72, 144, 216, 288, 0); saturation 50 is the middle row
    const { ring } = faceLayout(START_FACE, { h: 216, s: 50, l: 56 }, 0);
    expect(ring).toEqual({ col: 2, row: 3, kind: "exact" });
  });

  it("sits on the top row for S 100 and the bottom row for S 0", () => {
    expect(faceLayout(START_FACE, { h: 216, s: 100, l: 56 }, 0).ring.row).toBe(0);
    expect(faceLayout(START_FACE, { h: 216, s: 0, l: 56 }, 0).ring.row).toBe(GRID_ROWS - 1);
  });

  it("is approx when either axis is between patches", () => {
    expect(faceLayout(START_FACE, { h: 210, s: 50, l: 56 }, 0).ring.kind).toBe("approx");
    expect(faceLayout(START_FACE, { h: 216, s: 51, l: 56 }, 0).ring.kind).toBe("approx");
  });

  it("is approx after zooming out from a fine pick, exact at the zoom it was picked", () => {
    // S on x: 56.25 at zoom 4 (step 1.5625) is stored as 56.3; at zoom 0 it lies between 50 and 75
    const face: Face = { depth: "l", x: "s", y: "h" };
    const fine = { h: 0, s: 56.3, l: 56 };
    expect(faceLayout(face, fine, 4).ring.kind).toBe("exact");
    expect(faceLayout(face, fine, 0).ring.kind).toBe("approx");
  });

  it("the ringed patch's color is the selection when exact", () => {
    for (const [face, zoom, sel] of cases) {
      const { params, ring } = faceLayout(face, sel, zoom);
      if (ring.kind === "exact") expect(patchColor(params, ring.col, ring.row)).toEqual(sel);
    }
  });
});

describe("faceColors", () => {
  it("lists all 35 patch colors, top row first", () => {
    const sel = { h: 210, s: 64, l: 56 };
    const { params } = faceLayout(START_FACE, sel, 1);
    expect(faceColors(params)).toEqual(referenceGrid(START_FACE, sel, 1).flat());
  });
});

describe("peekStrips", () => {
  it.each(cases)(`${name}: each strip matches its axisWindow definition`, (face, zoom, sel) => {
    const strips = peekStrips(face, sel, zoom);
    const depthX = axisWindow(face.depth, GRID_COLUMNS, zoom, sel[face.depth]).values;
    const depthY = axisWindow(face.depth, GRID_ROWS, zoom, sel[face.depth]).values;
    const ys = axisWindow(face.y, GRID_ROWS, zoom, sel[face.y]).values;
    const xs = axisWindow(face.x, GRID_COLUMNS, zoom, sel[face.x]).values;
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
    const sideways = faceLayout(turn(face, "horizontal"), sel, zoom).params;
    const upright = faceLayout(turn(face, "vertical"), sel, zoom).params;
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

  it("runs hue from 359.9 to 0", () => {
    const stops = ceilingStops({ depth: "h", x: "s", y: "l" }, { h: 210, s: 64, l: 56 }, 5);
    expect(stops.map((c) => c.h)).toEqual([359.9, 269.9, 180, 90, 0]);
  });
});

describe("faceVars", () => {
  it("returns all nine custom properties as finite numbers", () => {
    const vars = faceVars(faceLayout(START_FACE, { h: 5, s: 64, l: 56 }, 3).params);
    expect(Object.keys(vars).sort()).toEqual(
      ["h", "s", "l"].flatMap((v) => [`--${v}-base`, `--${v}-col`, `--${v}-row`]).sort(),
    );
    for (const value of Object.values(vars)) expect(Number.isFinite(value)).toBe(true);
    expect(vars).toMatchObject({ "--h-base": -9, "--h-col": 9, "--h-row": 0, "--l-base": 56 });
  });
});

describe("patchBackground", () => {
  it("writes the column and row in as literals", () => {
    expect(patchBackground(2, 3)).toMatchInlineSnapshot(
      `"hsl(calc(var(--h-base) + 2 * var(--h-col) + 3 * var(--h-row)) calc((var(--s-base) + 2 * var(--s-col) + 3 * var(--s-row)) * 1%) calc((var(--l-base) + 2 * var(--l-col) + 3 * var(--l-row)) * 1%))"`,
    );
  });
});
