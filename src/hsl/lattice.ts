import { normalizeHue, roundChannel } from "../color/hsl";
import { type Variable, VARIABLES } from "./cube";

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

const clamp = (x: number, min: number, max: number): number => Math.min(max, Math.max(min, x));

/**
 * The n patch values of one axis at a zoom level, on a lattice fixed per variable, n and zoom.
 * The window is centered on `center`, so picking a patch never moves the grid; when `selected`
 * falls outside it, it centers on `selected` instead, so `nearest` always describes a value in
 * the window. S and L shift to stay inside 0–100; hue wraps. Values are computed per lattice
 * index, never accumulated, so nothing drifts.
 */
export const axisWindow = (
  variable: Variable,
  n: number,
  zoom: ZoomLevel,
  center: number,
  selected: number,
): AxisWindow => {
  const { wraps, max } = VARIABLES[variable];
  const steps = (wraps ? n : n - 1) * 2 ** zoom;
  const step = max / steps;
  // k · max / steps is k · step with a single rounding, so the S/L ends are exactly 0 and 100
  const at = (k: number) => (k * max) / steps;
  const half = Math.floor(n / 2);
  const indexOf = (value: number) =>
    wraps
      ? ((Math.round(value / step) % steps) + steps) % steps
      : clamp(Math.round(value / step), 0, steps);
  // The window's first index, centered on a lattice index; S and L stay inside 0–100.
  const startAt = (k: number) => (wraps ? k - half : clamp(k - half, 0, steps - (n - 1)));

  const picked = indexOf(selected);
  let k0 = startAt(indexOf(center));
  // A selection counts as inside while its nearest lattice index is one of the window's, so a
  // value up to half a step past the edge marks the edge patch (approx) rather than moving the window.
  let nearest = wraps ? (((picked - k0) % steps) + steps) % steps : picked - k0;
  if (nearest < 0 || nearest >= n) {
    k0 = startAt(picked);
    nearest = picked - k0;
  }

  const values = Array.from({ length: n }, (_, i) =>
    wraps ? normalizeHue(at(k0 + i)) : at(k0 + i),
  );
  return {
    values,
    nearest,
    exact: roundChannel(variable, values[nearest]) === selected,
    step,
    first: at(k0),
  };
};
