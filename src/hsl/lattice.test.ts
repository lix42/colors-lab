import { describe, expect, it } from "vite-plus/test";
import { normalizeHue, roundChannel } from "../color/hsl";
import { axisWindow, type ZoomLevel } from "./lattice";

const ZOOMS: ZoomLevel[] = [0, 1, 2, 3, 4];

describe("axisWindow: saturation and lightness", () => {
  it.each([0, 12.5, 37, 64, 100])(
    "at zoom 0 the 5-value window is the full range (centered %d)",
    (sel) => {
      expect(axisWindow("s", 5, 0, sel, sel).values).toEqual([0, 25, 50, 75, 100]);
      expect(axisWindow("l", 5, 0, sel, sel).values).toEqual([0, 25, 50, 75, 100]);
    },
  );

  it.each([0, 40, 100])("at zoom 0 the 7-value window is the full range (centered %d)", (sel) => {
    expect(axisWindow("s", 7, 0, sel, sel).values).toEqual([
      0,
      100 / 6,
      200 / 6,
      50,
      400 / 6,
      500 / 6,
      100,
    ]);
  });

  it("centers on the lattice value nearest the selection", () => {
    // zoom 2, n 5: step 6.25
    const w = axisWindow("s", 5, 2, 50, 50);
    expect(w.step).toBe(6.25);
    expect(w.values).toEqual([37.5, 43.75, 50, 56.25, 62.5]);
    expect(w.nearest).toBe(2);
    expect(w.exact).toBe(true);
  });

  it("moves with the center, not with the selection", () => {
    // the selection stays at 50 and only the center moves, so the window has to follow the center
    expect(axisWindow("s", 5, 2, 50, 50).values).toEqual([37.5, 43.75, 50, 56.25, 62.5]);
    expect(axisWindow("s", 5, 2, 62.5, 50).values).toEqual([50, 56.25, 62.5, 68.75, 75]);
  });

  it.each(ZOOMS.flatMap((z) => [0, 0.1, 99.9, 100].map((sel) => [z, sel] as const)))(
    "zoom %d, selected %d: the window shifts but stays inside 0–100",
    (zoom, sel) => {
      for (const n of [5, 7]) {
        const w = axisWindow("l", n, zoom, sel, sel);
        expect(w.values).toHaveLength(n);
        expect(w.values[0]).toBeGreaterThanOrEqual(0);
        expect(w.values[n - 1]).toBeLessThanOrEqual(100);
        expect(w.values[0] === 0 || w.values[n - 1] === 100).toBe(true);
        expect(w.values[w.nearest]).toBe(sel < 50 ? 0 : 100);
      }
    },
  );

  it("does not drift at zoom 4: each value comes from its lattice index", () => {
    const w = axisWindow("s", 7, 4, 100, 100);
    expect(w.values[6]).toBe(100);
    expect(w.values).toEqual([90, 91, 92, 93, 94, 95, 96].map((k) => (k * 100) / 96));
    expect(axisWindow("h", 7, 4, 359.9, 359.9).values[3]).toBe(0);
  });

  it("exact vs nearest after zooming out from a fine pick", () => {
    // at zoom 4 (step 1.5625) the lattice value 56.25 is stored as 56.3; at zoom 0 it lies between 50 and 75
    const fine = axisWindow("s", 5, 4, 56.3, 56.3);
    expect(fine.exact).toBe(true);
    const coarse = axisWindow("s", 5, 0, 56.3, 56.3);
    expect(coarse.values[coarse.nearest]).toBe(50);
    expect(coarse.exact).toBe(false);
  });

  it("an exact pick of 18.75 at zoom 2, stored as 18.8, is exact", () => {
    const w = axisWindow("s", 5, 2, 18.8, 18.8);
    expect(w.values[w.nearest]).toBe(18.75);
    expect(w.exact).toBe(true);
  });
});

describe("axisWindow: center apart from the selection", () => {
  it("builds the window from the center, with nearest pointing at the selection", () => {
    const w = axisWindow("s", 5, 2, 50, 62.5);
    expect(w.values).toEqual([37.5, 43.75, 50, 56.25, 62.5]);
    expect(w.nearest).toBe(4);
    expect(w.exact).toBe(true);
  });

  it("re-centers on the selection when its nearest value falls outside", () => {
    const w = axisWindow("s", 5, 2, 50, 75);
    expect(w.values).toEqual([62.5, 68.75, 75, 81.25, 87.5]);
    expect(w.nearest).toBe(2);
  });

  it("keeps the window while the selection is within half a step of the edge", () => {
    // step 6.25: 65 is nearer the edge value 62.5 than the next lattice value 68.75
    const w = axisWindow("s", 5, 2, 50, 65);
    expect(w.values[4]).toBe(62.5);
    expect(w.nearest).toBe(4);
    expect(w.exact).toBe(false);
  });

  it("re-centers on a selection below the window", () => {
    const w = axisWindow("s", 5, 2, 50, 20);
    expect(w.values).toEqual([6.25, 12.5, 18.75, 25, 31.25]);
    expect(w.nearest).toBe(2);
  });

  it("keeps the window for a selection within half a step below the first value", () => {
    // step 6.25: the window from center 50 starts at 37.5, and 36 is nearer it than 31.25
    const w = axisWindow("s", 5, 2, 50, 36);
    expect(w.values[0]).toBe(37.5);
    expect(w.nearest).toBe(0);
    expect(w.exact).toBe(false);
  });

  it("re-centers across the hue wrap", () => {
    // zoom 3, n 5: step 9, so the window around the lattice value 9 reaches back past 0
    const w = axisWindow("h", 5, 3, 180, 9);
    expect(w.values).toEqual([351, 0, 9, 18, 27]);
    expect(w.nearest).toBe(2);
    expect(w.exact).toBe(true);
  });

  it("never re-centers a full-circle hue window", () => {
    const w = axisWindow("h", 5, 0, 210, 0);
    expect(w.values).toEqual([72, 144, 216, 288, 0]);
    expect(w.nearest).toBe(4);
    expect(w.exact).toBe(true);
  });

  it("a pick inside the window never moves it", () => {
    const start = axisWindow("s", 5, 3, 50, 50);
    for (const picked of start.values) {
      expect(axisWindow("s", 5, 3, 50, picked).values).toEqual(start.values);
    }
  });
});

describe("axisWindow: hue", () => {
  it("covers the full circle at zoom 0", () => {
    expect(axisWindow("h", 5, 0, 210, 210).values).toEqual([72, 144, 216, 288, 0]);
  });

  it("wraps around 0/360 (selection 350 at 1×)", () => {
    const w = axisWindow("h", 5, 0, 350, 350);
    expect(w.values).toEqual([216, 288, 0, 72, 144]);
    expect(w.values[w.nearest]).toBe(0);
    expect(w.exact).toBe(false);
  });

  it("wraps when zoomed in near 0", () => {
    // zoom 3, n 5: step 9
    const w = axisWindow("h", 5, 3, 5, 5);
    expect(w.step).toBe(9);
    expect(w.first).toBe(-9);
    expect(w.values).toEqual([351, 0, 9, 18, 27]);
    expect(w.nearest).toBe(2);
    expect(w.values[w.nearest]).toBe(9);
  });

  it("puts the center's lattice value in the middle at every zoom", () => {
    for (const sel of [0, 0.1, 179.9, 359.9]) {
      for (const zoom of ZOOMS) {
        const w = axisWindow("h", 7, zoom, sel, sel);
        expect(w.nearest).toBe(3);
      }
    }
  });

  it("359.9 at zoom 0 rounds to the 0 patch and is not exact", () => {
    const w = axisWindow("h", 5, 0, 359.9, 359.9);
    expect(w.values[w.nearest]).toBe(0);
    expect(w.exact).toBe(false);
  });

  it("a fine hue pick is exact", () => {
    // zoom 4, n 7: step 360 / 112 = 3.2142…; k = 66 → 212.142… stored as 212.1
    const w = axisWindow("h", 7, 4, 212.1, 212.1);
    expect(w.exact).toBe(true);
  });
});

describe("axisWindow: first and step", () => {
  const cases = (["h", "s", "l"] as const).flatMap((v) =>
    ZOOMS.flatMap((z) =>
      [0, 5, 18.8, 56.3, 99.9, 100, 212.1, 350, 359.9].flatMap((sel) =>
        v !== "h" && sel > 100 ? [] : [5, 7].map((n) => [v, n, z, sel] as const),
      ),
    ),
  );

  it.each(cases)(
    "%s, n %d, zoom %d, selected %d: normalizeHue(first + i · step) matches values[i] after rounding",
    (v, n, zoom, sel) => {
      const w = axisWindow(v, n, zoom, sel, sel);
      w.values.forEach((value, i) => {
        const fromAffine = w.first + i * w.step;
        expect(roundChannel(v, v === "h" ? normalizeHue(fromAffine) : fromAffine)).toBe(
          roundChannel(v, value),
        );
      });
    },
  );
});
