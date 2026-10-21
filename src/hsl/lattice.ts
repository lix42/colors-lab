import { normalizeHue, roundHsl } from "../color/hsl";
import type { Variable } from "./cube";

/** Shown as 2^z: 1×, 2×, 4×, 8×, 16×. */
export type ZoomLevel = 0 | 1 | 2 | 3 | 4;

export type AxisWindow = {
  /** n patch values, ascending (hue: ascending modulo 360). */
  values: number[];
  /** Index of the value nearest the selection. */
  nearest: number;
  /** The selection equals values[nearest] rounded the way roundHsl rounds the channel. */
  exact: boolean;
  /** Lattice step at this zoom. */
  step: number;
  /** k₀ · step: values[0] before normalizeHue, so a hue window's may be negative. */
  first: number;
};

/** Rounds one channel exactly as `roundHsl` would store it (hue: 359.96 → 0). */
export const roundChannel = (variable: Variable, value: number): number =>
  roundHsl({ h: 0, s: 0, l: 0, [variable]: value })[variable];

const clamp = (x: number, min: number, max: number): number => Math.min(max, Math.max(min, x));

/**
 * The n patch values of one axis at a zoom level, on a lattice fixed per variable, n and zoom,
 * centered on the lattice value nearest `selected`. S and L shift to stay inside 0–100; hue wraps.
 * Values are computed per lattice index, never accumulated, so nothing drifts.
 */
export const axisWindow = (
  variable: Variable,
  n: number,
  zoom: ZoomLevel,
  selected: number,
): AxisWindow => {
  const half = Math.floor(n / 2);
  const wraps = variable === "h";
  const max = wraps ? 360 : 100;
  const steps = (wraps ? n : n - 1) * 2 ** zoom;
  const step = max / steps;
  // k · max / steps is k · step with a single rounding, so the S/L ends are exactly 0 and 100
  const at = (k: number) => (k * max) / steps;
  let k0: number;
  let nearest: number;
  if (wraps) {
    k0 = (Math.round(selected / step) % steps) - half;
    nearest = half;
  } else {
    const c = clamp(Math.round(selected / step), 0, steps);
    k0 = clamp(c - half, 0, steps - (n - 1));
    nearest = c - k0;
  }
  const values = Array.from({ length: n }, (_, i) =>
    wraps ? normalizeHue(at(k0 + i)) : at(k0 + i),
  );
  const exact = roundChannel(variable, values[nearest]) === selected;
  return { values, nearest, exact, step, first: at(k0) };
};
