import { normalizeHue, roundChannel } from "../color/hsl";
import { type Variable, VARIABLES } from "./cube";

/** Shown as 2^z: 1×, 2×, 4×, 8×, 16×. */
export type ZoomLevel = 0 | 1 | 2 | 3 | 4;

/** One grid axis's possible patch values: origin + k · step for integer k (S/L: only those in 0–100). */
export type AxisLattice = { origin: number; step: number };

export type AxisWindow = {
  /** n patch values, ascending (hue: ascending modulo 360). */
  values: number[];
  /** Index of the patch the selection is on. */
  selectedIndex: number;
  /** The lattice's step. */
  step: number;
  /** origin + k₀ · step: values[0] before normalizeHue, so a hue window's may be negative or past 360. */
  first: number;
};

const clamp = (x: number, min: number, max: number): number => Math.min(max, Math.max(min, x));

const mod = (k: number, m: number): number => ((k % m) + m) % m;

// Absorbs float noise in index arithmetic: 50 / (100 / 6) is 2.9999999999999996, not 3.
const EPS = 1e-9;

/** The zoom level's step if the patches didn't follow the selection: S/L fit n patches in 0–100 at 1×. */
const nominalStep = (variable: Variable, n: number, zoom: ZoomLevel): number => {
  const { wraps, max } = VARIABLES[variable];
  return max / ((wraps ? n : n - 1) * 2 ** zoom);
};

/**
 * The lattice's indices. Hue repeats every `period` indices; S and L keep `lo`…`hi`, the indices
 * whose values lie in 0–100 (negative when the origin is 100).
 */
const indexRange = (variable: Variable, { origin, step }: AxisLattice) => {
  const { max } = VARIABLES[variable];
  return {
    period: Math.round(max / step),
    lo: Math.ceil(-origin / step - EPS),
    hi: Math.floor((max - origin) / step + EPS),
  };
};

/** The lattice index nearest `value`: hue modulo the period, S/L limited to the in-range indices. */
const latticeIndex = (variable: Variable, lattice: AxisLattice, value: number): number => {
  const { origin, step } = lattice;
  const { period, lo, hi } = indexRange(variable, lattice);
  return VARIABLES[variable].wraps
    ? mod(Math.round(normalizeHue(value - origin) / step), period)
    : clamp(Math.round((value - origin) / step), lo, hi);
};

/**
 * Where the window starts (`k0`, a lattice index), which of its patches the selection is on, and the
 * center it used. Centered on `center`, so picking a patch never moves the grid; when the selection's
 * index isn't in that window, centered on the selection instead. S and L stay inside 0–100; hue wraps.
 */
const placeWindow = (
  variable: Variable,
  n: number,
  lattice: AxisLattice,
  center: number,
  selected: number,
): { k0: number; selectedIndex: number; center: number } => {
  const { wraps } = VARIABLES[variable];
  const { period, lo, hi } = indexRange(variable, lattice);
  const half = Math.floor(n / 2);
  const startAt = (k: number) => (wraps ? k - half : clamp(k - half, lo, hi - (n - 1)));
  const offsetIn = (k0: number, k: number) => (wraps ? mod(k - k0, period) : k - k0);

  const picked = latticeIndex(variable, lattice, selected);
  const k0 = startAt(latticeIndex(variable, lattice, center));
  const selectedIndex = offsetIn(k0, picked);
  if (selectedIndex >= 0 && selectedIndex < n) return { k0, selectedIndex, center };
  const recentered = startAt(picked);
  return { k0: recentered, selectedIndex: offsetIn(recentered, picked), center: selected };
};

/**
 * The lattice the patches are laid on, so the selection is always a patch and the steps are even.
 * Hue runs through the selection at the nominal step. S and L run through the selection and one
 * range end, with the largest step up to the nominal one that fits a whole number of times between
 * them. An end the laid window shows wins; otherwise the larger step, a tie going to 0. `end` forces
 * the end (the edge rule).
 */
export const layLattice = (
  variable: Variable,
  n: number,
  zoom: ZoomLevel,
  selected: number,
  end?: 0 | 100,
): AxisLattice => {
  const d0 = nominalStep(variable, n, zoom);
  if (VARIABLES[variable].wraps) return { origin: selected, step: d0 };
  const from = (origin: 0 | 100): AxisLattice => {
    const dist = Math.abs(selected - origin);
    return { origin, step: dist === 0 ? d0 : dist / Math.max(1, Math.ceil(dist / d0 - EPS)) };
  };
  if (end !== undefined) return from(end);
  // A step never exceeds the distance to its end, so an end closer than half a nominal step would
  // squeeze the patches together (S 99.9 → step 0.1); the other end anchors instead. At least one
  // end always qualifies: the farther one is 50 or more away, and d₀ ≤ 100 / (n − 1).
  const tooClose = (origin: 0 | 100) => {
    const dist = Math.abs(selected - origin);
    return dist > 0 && dist < d0 / 2;
  };
  if (tooClose(0)) return from(100);
  if (tooClose(100)) return from(0);
  // The origin is index 0, so the end shows when the laid window's first (or last) index is 0.
  const shows = (lattice: AxisLattice) => {
    const { k0 } = placeWindow(variable, n, lattice, selected, selected);
    return lattice.origin === 0 ? k0 === 0 : k0 + n - 1 === 0;
  };
  const low = from(0);
  const high = from(100);
  const showsLow = shows(low);
  if (showsLow !== shows(high)) return showsLow ? low : high;
  return high.step > low.step ? high : low;
};

/**
 * The center the window actually uses: `center`, or the selection when the selection isn't in the
 * window around `center`. Storing it keeps the next pick from moving the grid.
 */
export const windowCenter = (
  variable: Variable,
  n: number,
  lattice: AxisLattice,
  center: number,
  selected: number,
): number => placeWindow(variable, n, lattice, center, selected).center;

/** Whether `value` is a lattice value as stored: the nearest one rounded the way roundHsl rounds it. */
export const onLattice = (variable: Variable, lattice: AxisLattice, value: number): boolean =>
  roundChannel(variable, lattice.origin + latticeIndex(variable, lattice, value) * lattice.step) ===
  value;

/**
 * The n patch values of one axis on its lattice, in a window placed by `placeWindow`. Values are
 * computed per lattice index, never accumulated, so nothing drifts.
 */
export const axisWindow = (
  variable: Variable,
  n: number,
  lattice: AxisLattice,
  center: number,
  selected: number,
): AxisWindow => {
  const { wraps, max } = VARIABLES[variable];
  const { origin, step } = lattice;
  const at = (k: number) => origin + k * step;
  const { k0, selectedIndex } = placeWindow(variable, n, lattice, center, selected);
  const values = Array.from({ length: n }, (_, i) =>
    wraps ? normalizeHue(at(k0 + i)) : clamp(at(k0 + i), 0, max),
  );
  return { values, selectedIndex, step, first: at(k0) };
};

/** The window a turn or zoom shows: the lattice laid from `value`, centered on it. */
export const laidWindow = (
  variable: Variable,
  n: number,
  zoom: ZoomLevel,
  value: number,
): AxisWindow => axisWindow(variable, n, layLattice(variable, n, zoom, value), value, value);

/**
 * The edge rule (S and L): when the selection is on an edge patch that is the lattice's last value
 * before a range end, and that end isn't a patch, returns the lattice laid on that end and a center
 * that pins the window to it. Null when the rule doesn't apply: hue, a middle patch, an edge patch with more
 * lattice values beyond it, an end that is already a patch, or an end closer than half a nominal
 * step, which layLattice won't anchor on either.
 */
export const edgeRelay = (
  variable: Variable,
  n: number,
  zoom: ZoomLevel,
  lattice: AxisLattice,
  center: number,
  selected: number,
): { lattice: AxisLattice; center: number } | null => {
  if (VARIABLES[variable].wraps) return null;
  const { lo, hi } = indexRange(variable, lattice);
  const { k0, selectedIndex } = placeWindow(variable, n, lattice, center, selected);
  const k = k0 + selectedIndex;
  const end =
    selectedIndex === 0 && k === lo ? 0 : selectedIndex === n - 1 && k === hi ? 100 : null;
  if (end === null) return null;
  // The edge patch, unrounded, is the end within rounding: the end is already a patch.
  const edge = lattice.origin + k * lattice.step;
  if (roundChannel(variable, edge) === end) return null;
  // Measured from the selection, which the new lattice is laid from, as layLattice measures it.
  if (Math.abs(end - selected) < nominalStep(variable, n, zoom) / 2) return null;
  return { lattice: layLattice(variable, n, zoom, selected, end), center: end };
};

/**
 * One arrow-key step along an axis (`d` = +1 toward the max): the neighbouring patch, or past the
 * window's edge the next lattice value, with the window scrolled one step so the selection stays on
 * the edge patch. Then the edge rule. The value is stored-rounded; a hue center is normalized. Past
 * the last S/L lattice value, the edge rule may lay the lattice on the end, which is then the next
 * patch. Null when S or L can't move further.
 */
export const axisStep = (
  variable: Variable,
  n: number,
  zoom: ZoomLevel,
  lattice: AxisLattice,
  center: number,
  selected: number,
  d: -1 | 1,
): { value: number; center: number; lattice: AxisLattice } | null => {
  const { wraps, max } = VARIABLES[variable];
  const { lo, hi } = indexRange(variable, lattice);
  const at = (k: number) => lattice.origin + k * lattice.step;
  const placed = placeWindow(variable, n, lattice, center, selected);
  const j = placed.selectedIndex + d;
  const k = placed.k0 + j;
  if (!wraps && (k < lo || k > hi)) {
    // The selection is on the edge patch, the last lattice value before the end. Re-laid on that end,
    // the selection is less than a step from it, so the step is that distance and lands on the end.
    const relay = edgeRelay(variable, n, zoom, lattice, placed.center, selected);
    return relay && axisStep(variable, n, zoom, relay.lattice, relay.center, selected, d);
  }
  const value = roundChannel(variable, wraps ? normalizeHue(at(k)) : clamp(at(k), 0, max));
  let next = placed.center;
  if (j < 0 || j >= n) {
    // The window starts ⌊n/2⌋ before its center, so this center puts k on the edge it crossed.
    const half = Math.floor(n / 2);
    const c = d > 0 ? k - (n - 1) + half : k + half;
    next = wraps ? normalizeHue(at(c)) : at(c);
  }
  const relay = edgeRelay(variable, n, zoom, lattice, next, value);
  return { value, ...(relay ?? { center: next, lattice }) };
};
