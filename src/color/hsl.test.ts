import { describe, expect, it } from "vite-plus/test";
import { contrastInk, normalizeHue, relativeLuminance, roundHsl, toCss, toHex } from "./hsl";

describe("normalizeHue", () => {
  it.each([
    [0, 0],
    [360, 0],
    [725, 5],
    [-30, 330],
    [-360, 0],
    [-725, 355],
  ])("%d → %d", (h, expected) => {
    expect(normalizeHue(h)).toBe(expected);
  });

  it("never returns 360 for a tiny negative hue", () => {
    expect(normalizeHue(-1e-14)).toBe(0);
  });
});

describe("roundHsl", () => {
  it.each([
    [0.04, 0],
    [0.05, 0.1],
    [0.15, 0.2],
    [2.55, 2.6],
    [56.45, 56.5],
    [56.449, 56.4],
  ])("rounds %d to %d at the 0.05 boundary", (x, expected) => {
    expect(roundHsl({ h: x, s: x, l: x })).toEqual({ h: expected, s: expected, l: expected });
  });

  it("wraps a hue that rounds up to 360 back to 0", () => {
    expect(roundHsl({ h: 359.96, s: 50, l: 50 }).h).toBe(0);
    expect(roundHsl({ h: 359.94, s: 50, l: 50 }).h).toBe(359.9);
  });

  it("normalizes negative and over-360 hues", () => {
    expect(roundHsl({ h: -0.05, s: 50, l: 50 }).h).toBe(0);
    expect(roundHsl({ h: -0.06, s: 50, l: 50 }).h).toBe(359.9);
    expect(roundHsl({ h: -0.04, s: 50, l: 50 }).h).toBe(0);
    expect(roundHsl({ h: -149.65, s: 50, l: 50 }).h).toBe(210.4);
    expect(roundHsl({ h: 370.04, s: 50, l: 50 }).h).toBe(10);
    expect(roundHsl({ h: 725.55, s: 50, l: 50 }).h).toBe(5.6);
  });

  it("clamps saturation and lightness to [0, 100]", () => {
    expect(roundHsl({ h: 10, s: -5, l: 120 })).toEqual({ h: 10, s: 0, l: 100 });
    expect(roundHsl({ h: 10, s: 100.04, l: -0.04 })).toEqual({ h: 10, s: 100, l: 0 });
  });
});

describe("toCss", () => {
  it("formats space-separated hsl()", () => {
    expect(toCss({ h: 210, s: 64, l: 56 })).toBe("hsl(210 64% 56%)");
    expect(toCss({ h: 0.5, s: 12.3, l: 100 })).toBe("hsl(0.5 12.3% 100%)");
  });
});

describe("toHex", () => {
  it.each([
    [{ h: 0, s: 100, l: 50 }, "#FF0000"],
    [{ h: 120, s: 100, l: 50 }, "#00FF00"],
    [{ h: 240, s: 100, l: 50 }, "#0000FF"],
    [{ h: 0, s: 0, l: 0 }, "#000000"],
    [{ h: 0, s: 0, l: 100 }, "#FFFFFF"],
    [{ h: 0, s: 0, l: 50 }, "#808080"],
    [{ h: 210, s: 64, l: 56 }, "#478FD7"],
    [{ h: 30, s: 100, l: 50 }, "#FF8000"],
  ])("%o → %s", (c, expected) => {
    expect(toHex(c)).toBe(expected);
  });
});

describe("relativeLuminance", () => {
  it("is 0 for black, 1 for white and about 0.214 for mid gray", () => {
    expect(relativeLuminance({ h: 0, s: 0, l: 0 })).toBe(0);
    expect(relativeLuminance({ h: 0, s: 0, l: 100 })).toBeCloseTo(1, 10);
    expect(relativeLuminance({ h: 0, s: 0, l: 50 })).toBeCloseTo(0.214, 3);
  });
});

describe("contrastInk", () => {
  it.each([
    ["black", { h: 0, s: 0, l: 0 }, "light"],
    ["white", { h: 0, s: 0, l: 100 }, "dark"],
    ["yellow", { h: 60, s: 100, l: 50 }, "dark"],
    ["navy", { h: 240, s: 100, l: 25 }, "light"],
    ["pure blue", { h: 240, s: 100, l: 50 }, "light"],
    ["mid gray", { h: 0, s: 0, l: 50 }, "dark"],
  ])("picks %s ink on %s", (_name, c, expected) => {
    expect(contrastInk(c)).toBe(expected);
  });
});
