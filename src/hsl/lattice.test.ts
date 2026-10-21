import { describe, expect, it } from "vite-plus/test";
import { normalizeHue } from "../color/hsl";
import { axisWindow, roundChannel, type ZoomLevel } from "./lattice";

const ZOOMS: ZoomLevel[] = [0, 1, 2, 3, 4];

describe("axisWindow: saturation and lightness", () => {
  it.each([0, 12.5, 37, 64, 100])(
    "at zoom 0 the 5-value window is the full range (selected %d)",
    (sel) => {
      expect(axisWindow("s", 5, 0, sel).values).toEqual([0, 25, 50, 75, 100]);
      expect(axisWindow("l", 5, 0, sel).values).toEqual([0, 25, 50, 75, 100]);
    },
  );

  it.each([0, 40, 100])("at zoom 0 the 7-value window is the full range (selected %d)", (sel) => {
    expect(axisWindow("s", 7, 0, sel).values).toEqual([
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
    const w = axisWindow("s", 5, 2, 50);
    expect(w.step).toBe(6.25);
    expect(w.values).toEqual([37.5, 43.75, 50, 56.25, 62.5]);
    expect(w.nearest).toBe(2);
    expect(w.exact).toBe(true);
  });

  it("follows the selection: a different pick shifts the window", () => {
    expect(axisWindow("s", 5, 2, 62.5).values).toEqual([50, 56.25, 62.5, 68.75, 75]);
  });

  it.each(ZOOMS.flatMap((z) => [0, 0.1, 99.9, 100].map((sel) => [z, sel] as const)))(
    "zoom %d, selected %d: the window shifts but stays inside 0–100",
    (zoom, sel) => {
      for (const n of [5, 7]) {
        const w = axisWindow("l", n, zoom, sel);
        expect(w.values).toHaveLength(n);
        expect(w.values[0]).toBeGreaterThanOrEqual(0);
        expect(w.values[n - 1]).toBeLessThanOrEqual(100);
        expect(w.values[0] === 0 || w.values[n - 1] === 100).toBe(true);
        expect(w.values[w.nearest]).toBe(sel < 50 ? 0 : 100);
      }
    },
  );

  it("does not drift at zoom 4: each value comes from its lattice index", () => {
    const w = axisWindow("s", 7, 4, 100);
    expect(w.values[6]).toBe(100);
    expect(w.values).toEqual([90, 91, 92, 93, 94, 95, 96].map((k) => (k * 100) / 96));
    expect(axisWindow("h", 7, 4, 359.9).values[3]).toBe(0);
  });

  it("exact vs nearest after zooming out from a fine pick", () => {
    // at zoom 4 (step 1.5625) the lattice value 56.25 is stored as 56.3; at zoom 0 it lies between 50 and 75
    const fine = axisWindow("s", 5, 4, 56.3);
    expect(fine.exact).toBe(true);
    const coarse = axisWindow("s", 5, 0, 56.3);
    expect(coarse.values[coarse.nearest]).toBe(50);
    expect(coarse.exact).toBe(false);
  });

  it("an exact pick of 18.75 at zoom 2, stored as 18.8, is exact", () => {
    const w = axisWindow("s", 5, 2, 18.8);
    expect(w.values[w.nearest]).toBe(18.75);
    expect(w.exact).toBe(true);
  });
});

describe("axisWindow: hue", () => {
  it("covers the full circle at zoom 0", () => {
    expect(axisWindow("h", 5, 0, 210).values).toEqual([72, 144, 216, 288, 0]);
  });

  it("wraps around 0/360 (selection 350 at 1×)", () => {
    const w = axisWindow("h", 5, 0, 350);
    expect(w.values).toEqual([216, 288, 0, 72, 144]);
    expect(w.values[w.nearest]).toBe(0);
    expect(w.exact).toBe(false);
  });

  it("wraps when zoomed in near 0", () => {
    // zoom 3, n 5: step 9
    const w = axisWindow("h", 5, 3, 5);
    expect(w.step).toBe(9);
    expect(w.first).toBe(-9);
    expect(w.values).toEqual([351, 0, 9, 18, 27]);
    expect(w.nearest).toBe(2);
    expect(w.values[w.nearest]).toBe(9);
  });

  it("the selection's lattice value is always the middle", () => {
    for (const sel of [0, 0.1, 179.9, 359.9]) {
      for (const zoom of ZOOMS) {
        const w = axisWindow("h", 7, zoom, sel);
        expect(w.nearest).toBe(3);
      }
    }
  });

  it("359.9 at zoom 0 rounds to the 0 patch and is not exact", () => {
    const w = axisWindow("h", 5, 0, 359.9);
    expect(w.values[w.nearest]).toBe(0);
    expect(w.exact).toBe(false);
  });

  it("a fine hue pick is exact", () => {
    // zoom 4, n 7: step 360 / 112 = 3.2142…; k = 66 → 212.142… stored as 212.1
    const w = axisWindow("h", 7, 4, 212.1);
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
      const w = axisWindow(v, n, zoom, sel);
      w.values.forEach((value, i) => {
        const fromAffine = w.first + i * w.step;
        expect(roundChannel(v, v === "h" ? normalizeHue(fromAffine) : fromAffine)).toBe(
          roundChannel(v, value),
        );
      });
    },
  );
});
