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
const referenceGrid = (face: Face, center: Hsl, sel: Hsl, zoom: ZoomLevel): Hsl[][] => {
  const wx = axisWindow(face.x, GRID_COLUMNS, zoom, center[face.x], sel[face.x]);
  const wy = axisWindow(face.y, GRID_ROWS, zoom, center[face.y], sel[face.y]);
  return Array.from({ length: GRID_ROWS }, (_, row) =>
    Array.from({ length: GRID_COLUMNS }, (_, col) =>
      roundHsl(
        withVar(withVar(sel, face.x, wx.values[col]), face.y, wy.values[GRID_ROWS - 1 - row]),
      ),
    ),
  );
};

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
    const { params } = faceLayout(face, center, sel, zoom);
    const ref = referenceGrid(face, center, sel, zoom);
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLUMNS; col++) {
        expect(patchColor(params, col, row)).toEqual(ref[row][col]);
      }
    }
  });

  it("puts the y maximum on the top row and the depth constant", () => {
    const { params } = faceLayout(
      START_FACE,
      { h: 210, s: 64, l: 56 },
      { h: 210, s: 64, l: 56 },
      0,
    );
    expect(patchColor(params, 0, 0).s).toBe(100);
    expect(patchColor(params, 0, GRID_ROWS - 1).s).toBe(0);
    expect(params.l).toEqual({ base: 56, perCol: 0, perRow: 0 });
  });

  it("leaves hue bases unnormalized", () => {
    // x: zoom 3, step 9, window from -9; y: hue on rows with the top row past 360
    expect(
      faceLayout(START_FACE, { h: 5, s: 50, l: 50 }, { h: 5, s: 50, l: 50 }, 3).params.h.base,
    ).toBe(-9);
    const onY = faceLayout(
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

  it("lays the grid out around the center, with the ring on the selection", () => {
    // zoom 2 on S: step 6.25, window of 5 around the center 50 is 37.5…62.5, which holds 64's
    // nearest value 62.5, so the window stays put and the ring sits on it
    const face: Face = { depth: "h", x: "s", y: "l" };
    const { params, ring } = faceLayout(face, { ...sel, s: 50 }, sel, 2);
    expect(params.s.base).toBe(37.5);
    expect(ring.col).toBe(4);
    expect(ring.kind).toBe("approx");
  });

  it("re-centers when the selection's nearest value is outside the window", () => {
    const face: Face = { depth: "h", x: "s", y: "l" };
    const { params, ring } = faceLayout(face, { ...sel, s: 20 }, sel, 2);
    expect(params.s.base).toBe(50); // centered on 64's nearest value, 62.5
    expect(ring.col).toBe(2);
  });

  it("re-centers when the selection is below the window, keeping the ring on the grid", () => {
    // center 90 snaps to the lattice value 87.5, so the window is 75…100; the selection 64
    // (nearest 62.5) is below it
    const face: Face = { depth: "h", x: "s", y: "l" };
    const { params, ring } = faceLayout(face, { ...sel, s: 90 }, sel, 2);
    expect(params.s.base).toBe(50);
    expect(ring).toMatchObject({ col: 2, kind: "approx" });
  });

  it("keeps an exact ring when the center sits above the selection", () => {
    const face: Face = { depth: "h", x: "s", y: "l" };
    // both axes on a lattice value at zoom 2: S 62.5 (step 6.25) and L 50 (step 100/24)
    const exact = { ...sel, s: 62.5, l: 50 };
    const { params, ring } = faceLayout(face, { ...exact, s: 75 }, exact, 2);
    expect(params.s.base).toBe(62.5);
    expect(ring).toMatchObject({ col: 0, kind: "exact" });
  });

  it("keeps the window while the selection is within half a step of the edge", () => {
    // zoom 2 on S: the window from center 50 ends at 62.5; 65 is nearer 62.5 than 68.75
    const face: Face = { depth: "h", x: "s", y: "l" };
    const { params, ring } = faceLayout(face, { ...sel, s: 50 }, { ...sel, s: 65 }, 2);
    expect(params.s.base).toBe(37.5);
    expect(ring).toMatchObject({ col: 4, kind: "approx" });
  });
});

describe("faceLayout: ring", () => {
  it("is exact on a lattice selection, at the nearest column and row", () => {
    // zoom 0: hue 216 is column 2 (72, 144, 216, 288, 0); saturation 50 is the middle row
    const { ring } = faceLayout(START_FACE, { h: 216, s: 50, l: 56 }, { h: 216, s: 50, l: 56 }, 0);
    expect(ring).toEqual({ col: 2, row: 3, kind: "exact" });
  });

  it("sits on the top row for S 100 and the bottom row for S 0", () => {
    expect(
      faceLayout(START_FACE, { h: 216, s: 100, l: 56 }, { h: 216, s: 100, l: 56 }, 0).ring.row,
    ).toBe(0);
    expect(
      faceLayout(START_FACE, { h: 216, s: 0, l: 56 }, { h: 216, s: 0, l: 56 }, 0).ring.row,
    ).toBe(GRID_ROWS - 1);
  });

  it("is approx when either axis is between patches", () => {
    expect(
      faceLayout(START_FACE, { h: 210, s: 50, l: 56 }, { h: 210, s: 50, l: 56 }, 0).ring.kind,
    ).toBe("approx");
    expect(
      faceLayout(START_FACE, { h: 216, s: 51, l: 56 }, { h: 216, s: 51, l: 56 }, 0).ring.kind,
    ).toBe("approx");
  });

  it("is approx after zooming out from a fine pick, exact at the zoom it was picked", () => {
    // S on x: 56.25 at zoom 4 (step 1.5625) is stored as 56.3; at zoom 0 it lies between 50 and 75
    const face: Face = { depth: "l", x: "s", y: "h" };
    const fine = { h: 0, s: 56.3, l: 56 };
    expect(faceLayout(face, fine, fine, 4).ring.kind).toBe("exact");
    expect(faceLayout(face, fine, fine, 0).ring.kind).toBe("approx");
  });

  it("the ringed patch's color is the selection when exact", () => {
    let exactCases = 0;
    for (const [face, zoom, sel, center] of cases) {
      const { params, ring } = faceLayout(face, center, sel, zoom);
      if (ring.kind !== "exact") continue;
      exactCases++;
      expect(patchColor(params, ring.col, ring.row)).toEqual(sel);
    }
    expect(exactCases).toBeGreaterThan(0);
  });
});

describe("faceColors", () => {
  it("lists all 35 patch colors, top row first", () => {
    const sel = { h: 210, s: 64, l: 56 };
    const { params } = faceLayout(START_FACE, sel, sel, 1);
    expect(faceColors(params)).toEqual(referenceGrid(START_FACE, sel, sel, 1).flat());
  });
});

describe("peekStrips", () => {
  it.each(cases)(`${name}: each strip matches its axisWindow definition`, (face, zoom, sel) => {
    // strips ignore `center`: they always use the re-centered windows a turn would show
    const strips = peekStrips(face, sel, zoom);
    const depthX = axisWindow(
      face.depth,
      GRID_COLUMNS,
      zoom,
      sel[face.depth],
      sel[face.depth],
    ).values;
    const depthY = axisWindow(face.depth, GRID_ROWS, zoom, sel[face.depth], sel[face.depth]).values;
    const ys = axisWindow(face.y, GRID_ROWS, zoom, sel[face.y], sel[face.y]).values;
    const xs = axisWindow(face.x, GRID_COLUMNS, zoom, sel[face.x], sel[face.x]).values;
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
    // a turn re-centers, so the face a turn shows is laid out from the selection
    const sideways = faceLayout(turn(face, "horizontal"), sel, sel, zoom).params;
    const upright = faceLayout(turn(face, "vertical"), sel, sel, zoom).params;
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
    const { params } = faceLayout(face, sel, sel, 2);
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
      faceLayout(START_FACE, { h: 5, s: 64, l: 56 }, { h: 5, s: 64, l: 56 }, 3).params,
    );
    expect(Object.keys(vars).sort()).toEqual(
      ["h", "s", "l"].flatMap((v) => [`--${v}-base`, `--${v}-col`, `--${v}-row`]).sort(),
    );
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
