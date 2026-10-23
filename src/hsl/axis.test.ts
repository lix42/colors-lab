import { describe, expect, it } from "vite-plus/test";
import { normalizeHue, roundChannel } from "../color/hsl";
import {
  type AxisLattice,
  axisStep,
  axisWindow,
  edgeRelay,
  laidWindow,
  layLattice,
  onLattice,
  windowCenter,
  type ZoomLevel,
} from "./axis";

const ZOOMS: ZoomLevel[] = [0, 1, 2, 3, 4];

const rounded = (xs: number[]) => xs.map((x) => roundChannel("s", x));

describe("layLattice: saturation and lightness", () => {
  it("runs through the selection and one end with even steps (S 64 at 1×)", () => {
    expect(layLattice("s", 5, 0, 64)).toEqual({ origin: 0, step: 64 / 3 });
    expect(rounded(laidWindow("s", 5, 0, 64).values)).toEqual([0, 21.3, 42.7, 64, 85.3]);
  });

  it.each([0, 25, 50, 75, 100])("gives the nominal 5-value grid back for %d", (sel) => {
    expect(laidWindow("s", 5, 0, sel).values).toEqual([0, 25, 50, 75, 100]);
    expect(laidWindow("l", 5, 0, sel).values).toEqual([0, 25, 50, 75, 100]);
  });

  it("gives the nominal 7-value grid back for a selection on it", () => {
    expect(rounded(laidWindow("s", 7, 0, 50).values)).toEqual([0, 16.7, 33.3, 50, 66.7, 83.3, 100]);
  });

  it("never steps past the nominal step, so the window fits", () => {
    for (const zoom of ZOOMS) {
      for (let t = 0; t <= 1000; t += 7) {
        const sel = t / 10;
        const d0 = 100 / (4 * 2 ** zoom);
        const lattice = layLattice("s", 5, zoom, sel);
        expect(lattice.step).toBeLessThanOrEqual(d0 + 1e-9);
        // and never squeezes below half the nominal step, even a hair from an end
        expect(lattice.step).toBeGreaterThanOrEqual(d0 / 2 - 1e-9);
        const w = axisWindow("s", 5, lattice, sel, sel);
        expect(Math.min(...w.values)).toBeGreaterThanOrEqual(0);
        expect(Math.max(...w.values)).toBeLessThanOrEqual(100);
        expect(roundChannel("s", w.values[w.selectedIndex])).toBe(sel);
      }
    }
  });

  it("takes the end giving the larger step when both are in reach (1×)", () => {
    // from 0: 26 / 2 = 13; from 100: 74 / 3 ≈ 24.7
    expect(layLattice("s", 5, 0, 26)).toEqual({ origin: 100, step: 74 / 3 });
  });

  it("breaks a tie toward 0", () => {
    expect(layLattice("s", 5, 0, 50).origin).toBe(0);
  });

  it("takes the end the laid window shows", () => {
    // zoom 1: from 64 neither laid window shows its end, so the larger step (12, from 100) wins
    expect(layLattice("s", 5, 1, 64)).toEqual({ origin: 100, step: 12 });
    expect(rounded(laidWindow("s", 5, 1, 64).values)).toEqual([40, 52, 64, 76, 88]);
    // near 100 at zoom 2, only the window laid from 100 shows its end, so 100 is a patch
    expect(laidWindow("s", 5, 2, 90).values).toEqual([80, 85, 90, 95, 100]);
  });

  it("uses the larger step when neither end is in reach", () => {
    // zoom 2: the window spans 25, so neither end is in reach; 50 / 8 = 6.25 from both, a tie
    expect(layLattice("s", 5, 2, 50).origin).toBe(0);
    // from 0: 47 / 8 = 5.875; from 100: 53 / 9 ≈ 5.89
    expect(layLattice("s", 5, 2, 47).origin).toBe(100);
  });

  it("doesn't count an end as reachable when the centered window can't show it", () => {
    // zoom 1: 40 is within the window's span of 0, but the window laid from 0 (step 10) is
    // 20 … 60; neither end shows, so the larger step (12, from 100) wins
    expect(layLattice("s", 5, 1, 40)).toEqual({ origin: 100, step: 12 });
  });

  it("never divides by zero for a selection a hair from an end", () => {
    expect(Number.isFinite(layLattice("s", 5, 0, 1e-12, 0).step)).toBe(true);
  });

  it("never anchors on an end closer than half a nominal step", () => {
    // S 99.9 at 2×: from 100 the step would be 0.1, so it anchors on 0 (step 12.49)
    expect(layLattice("s", 5, 1, 99.9)).toEqual({ origin: 0, step: 99.9 / 8 });
    expect(layLattice("s", 5, 4, 0.3).origin).toBe(100);
    // a selection exactly at an end still anchors on it, at the nominal step
    expect(layLattice("s", 5, 1, 100)).toEqual({ origin: 100, step: 12.5 });
  });

  it("forces the end when asked", () => {
    expect(layLattice("s", 5, 0, 85.3, 100)).toEqual({ origin: 100, step: 100 - 85.3 });
    expect(layLattice("s", 5, 0, 64, 0)).toEqual({ origin: 0, step: 64 / 3 });
  });
});

describe("layLattice: hue", () => {
  it("runs through the selection at the nominal step", () => {
    expect(layLattice("h", 5, 0, 210)).toEqual({ origin: 210, step: 72 });
    expect(laidWindow("h", 5, 0, 210).values).toEqual([66, 138, 210, 282, 354]);
  });

  it("covers the full circle at zoom 0 with the selection in the middle", () => {
    const w = laidWindow("h", 5, 0, 0);
    expect(w.values).toEqual([216, 288, 0, 72, 144]);
    expect(w.selectedIndex).toBe(2);
  });

  it("wraps around 0/360 (selection 350 at 1×)", () => {
    const w = laidWindow("h", 5, 1, 350);
    expect(w.values).toEqual([278, 314, 350, 26, 62]);
    expect(w.selectedIndex).toBe(2);
  });

  it("puts the selection in the middle at every zoom", () => {
    for (const zoom of ZOOMS) {
      for (const sel of [0, 5, 212.1, 359.9]) {
        const w = laidWindow("h", 7, zoom, sel);
        expect(w.selectedIndex).toBe(3);
        expect(roundChannel("h", w.values[3])).toBe(sel);
      }
    }
  });
});

describe("onLattice", () => {
  const lattice = layLattice("s", 5, 0, 64); // 0, 21.33…, 42.67…, 64, 85.33…

  it("accepts a lattice value as it is stored, rounded to 0.1", () => {
    expect(onLattice("s", lattice, 21.3)).toBe(true);
    expect(onLattice("s", lattice, 85.3)).toBe(true);
    expect(onLattice("s", lattice, 0)).toBe(true);
  });

  it("rejects a value between lattice values", () => {
    expect(onLattice("s", lattice, 50)).toBe(false);
    expect(onLattice("s", lattice, 21.4)).toBe(false);
  });

  it("rejects an end that isn't a lattice value", () => {
    // 100 is past the last value 85.3, and 0 is below the last value 85.3 − 5 · 14.7 = 11.8
    expect(onLattice("s", lattice, 100)).toBe(false);
    expect(onLattice("s", { origin: 100, step: 100 - 85.3 }, 0)).toBe(false);
  });

  it("accepts a lattice value ending in 5 in the hundredths (S 18.75 stored as 18.8)", () => {
    // a raw ≤ 0.05 tolerance would reject it: 18.8 − 18.75 is 0.05000000000000071
    expect(onLattice("s", { origin: 0, step: 6.25 }, 18.8)).toBe(true);
  });

  it("wraps hue", () => {
    const hue = layLattice("h", 5, 1, 350);
    expect(onLattice("h", hue, 26)).toBe(true);
    expect(onLattice("h", hue, 314)).toBe(true);
    expect(onLattice("h", hue, 30)).toBe(false);
  });
});

describe("axisWindow", () => {
  const s64 = layLattice("s", 5, 2, 64); // origin 100, step 6

  it("moves with the center, not with the selection", () => {
    expect(axisWindow("s", 5, s64, 64, 64).values).toEqual([52, 58, 64, 70, 76]);
    expect(axisWindow("s", 5, s64, 76, 64).values).toEqual([64, 70, 76, 82, 88]);
  });

  it("a pick inside the window never moves it", () => {
    const w = axisWindow("s", 5, s64, 64, 64);
    for (const [i, value] of w.values.entries()) {
      const after = axisWindow("s", 5, s64, 64, roundChannel("s", value));
      expect(after.values).toEqual(w.values);
      expect(after.selectedIndex).toBe(i);
    }
  });

  it("re-centers on a selection outside the window", () => {
    const w = axisWindow("s", 5, s64, 64, 88);
    expect(w.values).toEqual([76, 82, 88, 94, 100]);
    expect(w.selectedIndex).toBe(2);
  });

  it("stays inside 0–100 at both ends, from either origin", () => {
    expect(axisWindow("s", 5, s64, 100, 100).values).toEqual([76, 82, 88, 94, 100]);
    // the lowest lattice value from origin 100 is 4, not 0
    const low = axisWindow("s", 5, s64, 0, 4);
    expect(low.values).toEqual([4, 10, 16, 22, 28]);
    expect(low.selectedIndex).toBe(0);
    const fromZero = layLattice("s", 5, 2, 10, 0); // origin 0, step 5
    expect(axisWindow("s", 5, fromZero, 100, 100).values).toEqual([80, 85, 90, 95, 100]);
  });

  it("re-centers across the hue wrap", () => {
    const hue = layLattice("h", 5, 1, 350); // step 36
    expect(axisWindow("h", 5, hue, 350, 134).values).toEqual([62, 98, 134, 170, 206]);
  });

  it("never re-centers a full-circle hue window", () => {
    const hue = layLattice("h", 5, 0, 0);
    for (const sel of [0, 72, 144, 216, 288]) {
      expect(axisWindow("h", 5, hue, 0, sel).values).toEqual([216, 288, 0, 72, 144]);
    }
  });

  it("has no drift at zoom 4", () => {
    const lattice = layLattice("s", 7, 4, 37.3);
    const w = axisWindow("s", 7, lattice, 37.3, 37.3);
    // every value is origin + k · step computed directly, not first plus accumulated steps
    const k0 = Math.round((w.first - lattice.origin) / lattice.step);
    w.values.forEach((value, i) => expect(value).toBe(lattice.origin + (k0 + i) * lattice.step));
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
      const w = laidWindow(v, n, zoom, sel);
      w.values.forEach((value, i) => {
        const fromAffine = w.first + i * w.step;
        expect(roundChannel(v, v === "h" ? normalizeHue(fromAffine) : fromAffine)).toBe(
          roundChannel(v, value),
        );
      });
    },
  );

  it.each(cases)("%s, n %d, zoom %d, selected %d: the selection is a patch", (v, n, zoom, sel) => {
    const w = laidWindow(v, n, zoom, sel);
    expect(roundChannel(v, w.values[w.selectedIndex])).toBe(sel);
  });
});

// 5 × 7 is the starting grid, not a fixed one (spec §3.4); the lattice takes any n ≥ 3.
describe("axisWindow: other patch counts", () => {
  it("at zoom 0 a nominal-grid selection fills the S/L range for n 3 and n 9", () => {
    expect(laidWindow("s", 3, 0, 50).values).toEqual([0, 50, 100]);
    expect(laidWindow("s", 9, 0, 62.5).values).toEqual([
      0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100,
    ]);
  });

  it("at zoom 0 a 3-value hue window splits the circle in thirds", () => {
    const w = laidWindow("h", 3, 0, 0);
    expect(w.values).toEqual([240, 0, 120]);
    expect(w).toMatchObject({ selectedIndex: 1, first: -120 });
  });

  it("a 9-value window shifts to stay inside 0–100", () => {
    const w = laidWindow("s", 9, 1, 100);
    expect(w.values[0]).toBe(50);
    expect(w.values[8]).toBe(100);
    expect(w.selectedIndex).toBe(8);
  });

  it("a 9-value hue window wraps around 0/360", () => {
    expect(laidWindow("h", 9, 2, 5).values).toEqual([325, 335, 345, 355, 5, 15, 25, 35, 45]);
  });

  it("an even n puts the center one patch past the middle", () => {
    // n 4: ⌊4/2⌋ = 2 patches before the center, 1 after
    const w = laidWindow("s", 4, 1, 50);
    expect(roundChannel("s", w.values[2])).toBe(50);
    expect(w.selectedIndex).toBe(2);
  });
});

describe("edgeRelay", () => {
  const s64: AxisLattice = layLattice("s", 5, 0, 64); // 0, 21.3, 42.7, 64, 85.3

  it("lays the lattice on the end less than one step beyond the edge patch", () => {
    const relay = edgeRelay("s", 5, 0, s64, 64, 85.3);
    expect(relay).toEqual({ lattice: { origin: 100, step: 100 - 85.3 }, center: 100 });
    const w = axisWindow("s", 5, relay!.lattice, relay!.center, 85.3);
    expect(rounded(w.values)).toEqual([41.2, 55.9, 70.6, 85.3, 100]);
    expect(w.selectedIndex).toBe(3);
  });

  it("works toward 0 too", () => {
    const high = layLattice("s", 5, 0, 36); // origin 100, step 21.33: 14.7 … 100
    const w = axisWindow("s", 5, high, 36, 36);
    const edge = roundChannel("s", w.values[0]);
    expect(edge).toBe(14.7);
    const relay = edgeRelay("s", 5, 0, high, 36, edge);
    expect(relay?.lattice.origin).toBe(0);
    expect(relay?.center).toBe(0);
  });

  it("measures half a nominal step from the stored selection, not the unrounded patch", () => {
    // 7 rows at 1× from S 61.1: the top patch 91.65 is 8.35 from 100, just over d₀/2 = 8.33, but
    // it's stored as 91.7, 8.3 from 100; a re-lay from 91.7 would squeeze the step to 8.3
    const lattice = layLattice("s", 7, 0, 61.1);
    const top = roundChannel("s", axisWindow("s", 7, lattice, 61.1, 61.1).values[6]);
    expect(top).toBe(91.7);
    expect(edgeRelay("s", 7, 0, lattice, 61.1, top)).toBeNull();
  });

  it("does nothing when the end is closer than half a nominal step", () => {
    // S 74.9 at 1×: 0, 25, 49.9, 74.9, 99.9; re-laying on 100 would squeeze the step to 0.1
    const lattice = layLattice("s", 5, 0, 74.9);
    expect(edgeRelay("s", 5, 0, lattice, 74.9, 99.9)).toBeNull();
    // S 90 at 1×: 100 is 10 away, under 12.5, so it isn't reachable at this zoom…
    expect(edgeRelay("s", 5, 0, layLattice("s", 5, 0, 90), 90, 90)).toBeNull();
    // …but at 2× half a nominal step is 6.25, so the laid window anchors on 100 and shows it
    expect(laidWindow("s", 5, 1, 90).values).toEqual([60, 70, 80, 90, 100]);
  });

  it("does nothing on a middle patch", () => {
    expect(edgeRelay("s", 5, 0, s64, 64, 64)).toBeNull();
  });

  it("does nothing when the edge patch is the end", () => {
    expect(edgeRelay("s", 5, 0, s64, 64, 0)).toBeNull();
    const nominal = layLattice("s", 5, 0, 75);
    expect(edgeRelay("s", 5, 0, nominal, 75, 100)).toBeNull();
  });

  it("does nothing when the end is a lattice value one step past the edge", () => {
    // 7 rows at zoom 1 from S 50: origin 0, step 8.33; the stored 8.3 and 91.7 are 0.03 short of
    // a step from 0 and 100, which are lattice values, so the window scrolls instead
    const lattice = layLattice("s", 7, 1, 50);
    expect(lattice.origin).toBe(0);
    expect(edgeRelay("s", 7, 1, lattice, 33.3, 8.3)).toBeNull();
    expect(edgeRelay("s", 7, 1, lattice, 66.7, 91.7)).toBeNull();
  });

  it("does nothing when a whole step remains before the end", () => {
    // zoom 2 from 40: the window's top patch is well short of 100
    const lattice = layLattice("s", 5, 2, 40);
    const top = roundChannel("s", axisWindow("s", 5, lattice, 40, 40).values[4]);
    expect(edgeRelay("s", 5, 2, lattice, 40, top)).toBeNull();
  });

  it("never applies to hue", () => {
    const hue = layLattice("h", 5, 1, 350);
    expect(edgeRelay("h", 5, 1, hue, 350, 278)).toBeNull();
  });
});

describe("windowCenter", () => {
  const hue = layLattice("h", 5, 1, 210); // 36° steps; window 138 … 282 around 210

  it("is the stored center while the selection is in its window", () => {
    expect(windowCenter("h", 5, hue, 210, 282)).toBe(210);
  });

  it("is the selection when the selection is outside that window", () => {
    expect(windowCenter("h", 5, hue, 210, 354)).toBe(354);
  });
});

describe("axisStep", () => {
  const s64 = layLattice("s", 5, 2, 64); // origin 100, step 6; window 52 … 76 around 64

  it("steps to the neighbouring patch inside the window, keeping center and lattice", () => {
    expect(axisStep("s", 5, 2, s64, 64, 64, 1)).toEqual({ value: 70, center: 64, lattice: s64 });
    expect(axisStep("s", 5, 2, s64, 64, 64, -1)).toEqual({ value: 58, center: 64, lattice: s64 });
  });

  it("scrolls one step past an edge, keeping the selection on the edge patch", () => {
    const up = axisStep("s", 5, 2, s64, 64, 76, 1)!;
    expect(up.value).toBe(82);
    expect(axisWindow("s", 5, s64, up.center, up.value)).toMatchObject({
      values: [58, 64, 70, 76, 82],
      selectedIndex: 4,
    });
    const down = axisStep("s", 5, 2, s64, 64, 52, -1)!;
    expect(down.value).toBe(46);
    expect(axisWindow("s", 5, s64, down.center, down.value)).toMatchObject({
      values: [46, 52, 58, 64, 70],
      selectedIndex: 0,
    });
  });

  it("stops S/L at the last lattice value inside 0–100", () => {
    const top = layLattice("s", 5, 0, 75); // 0, 25, 50, 75, 100
    expect(axisStep("s", 5, 0, top, 75, 100, 1)).toBeNull();
    expect(axisStep("s", 5, 0, top, 75, 0, -1)).toBeNull();
  });

  it("steps from the window the selection shows when it is outside the stored center's", () => {
    const hue = layLattice("h", 5, 1, 210); // shown around 354: 282, 318, 354, 30, 66
    expect(axisStep("h", 5, 1, hue, 210, 354, 1)).toEqual({ value: 30, center: 354, lattice: hue });
  });

  it("past the last value, lays the lattice on an end that isn't a patch and steps onto it", () => {
    const s = layLattice("s", 7, 0, 90); // 0, 15, … 90; 100 is 10 away
    expect(axisStep("s", 7, 0, s, 90, 90, 1)).toEqual({
      value: 100,
      center: 100,
      lattice: { origin: 100, step: 10 },
    });
  });

  it("does the same toward 0", () => {
    const s = layLattice("s", 7, 0, 10); // 10, 25, … 100; 0 is 10 away
    expect(axisStep("s", 7, 0, s, 10, 10, -1)).toEqual({
      value: 0,
      center: 0,
      lattice: { origin: 0, step: 10 },
    });
  });

  it("wraps hue and keeps its center in [0, 360)", () => {
    const hue = layLattice("h", 5, 1, 10); // 298, 334, 10, 46, 82
    const step = axisStep("h", 5, 1, hue, 10, 298, -1)!;
    expect(step.value).toBe(262);
    expect(step.center).toBeGreaterThanOrEqual(0);
    expect(step.center).toBeLessThan(360);
  });

  it("applies the edge rule to where it lands", () => {
    const s = layLattice("s", 5, 0, 64); // 0, 21.3, 42.7, 64, 85.3
    expect(axisStep("s", 5, 0, s, 64, 64, 1)).toEqual({
      value: 85.3,
      center: 100,
      lattice: { origin: 100, step: 100 - 85.3 },
    });
  });
});
