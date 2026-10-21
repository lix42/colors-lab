/** h in [0, 360), s and l in [0, 100]. */
export type Hsl = { h: number; s: number; l: number };

type Rgb = { r: number; g: number; b: number }; // channels in [0, 1]

/** Text colors used on top of arbitrary colors; the single source for the `picker.inkOnColor` tokens. */
export const INK_ON_COLOR = { dark: "#1A1A19", light: "#FFFFFF" } as const;

// Same result as ((h % 360) + 360) % 360, but adds 360 only to negatives so in-range hues stay exact
// (that form turns 56.4 into 56.39999…); `+ 0` turns -0 into 0. A tiny negative remainder can
// round up to exactly 360 when 360 is added, so that wraps to 0.
export const normalizeHue = (h: number): number => {
  const r = h % 360;
  if (r >= 0) return r + 0;
  const wrapped = r + 360;
  return wrapped === 360 ? 0 : wrapped;
};

// Half away from zero as the value reads in decimal: toPrecision(12) drops binary noise first,
// so 2.55 (stored as 2.54999…) rounds to 2.6 rather than 2.5. 12 digits rather than 15 also
// absorbs the larger error `%` leaves on big hues (725.55 % 360 is 5.54999…).
const roundTenth = (x: number): number =>
  (Math.sign(x) * Math.round(Number((Math.abs(x) * 10).toPrecision(12)))) / 10;

const clampPercent = (x: number): number => Math.min(100, Math.max(0, x));

/**
 * The single place colors are rounded: s and l clamped, each to 0.1. The hue is normalized
 * first, so -0.05 rounds as 359.95, and a hue that rounds up to 360 wraps to 0 (359.96 → 0).
 */
export const roundHsl = (c: Hsl): Hsl => ({
  h: normalizeHue(roundTenth(normalizeHue(c.h))),
  s: roundTenth(clampPercent(c.s)),
  l: roundTenth(clampPercent(c.l)),
});

/** Rounds one channel exactly as `roundHsl` stores it (hue: 359.96 → 0, s/l clamped). */
export const roundChannel = (channel: keyof Hsl, value: number): number =>
  roundHsl({ h: 0, s: 0, l: 0, [channel]: value })[channel];

/** `"hsl(210 64% 56%)"`. Prints values as given; pass a rounded color for clean output. */
export const toCss = (c: Hsl): string => `hsl(${c.h} ${c.s}% ${c.l}%)`;

const hslToRgb = ({ h, s, l }: Hsl): Rgb => {
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const k = (n + normalizeHue(h) / 30) % 12;
    return light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return { r: channel(0), g: channel(8), b: channel(4) };
};

const hexToRgb = (hex: string): Rgb => {
  const n = Number.parseInt(hex.slice(1), 16);
  return { r: ((n >> 16) & 0xff) / 255, g: ((n >> 8) & 0xff) / 255, b: (n & 0xff) / 255 };
};

/** `"#478FD7"`, uppercase. */
export const toHex = (c: Hsl): string => {
  const { r, g, b } = hslToRgb(c);
  const byte = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${byte(r)}${byte(g)}${byte(b)}`.toUpperCase();
};

const linearize = (x: number): number => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);

const rgbLuminance = ({ r, g, b }: Rgb): number =>
  0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);

/** WCAG relative luminance in [0, 1]. */
export const relativeLuminance = (c: Hsl): number => rgbLuminance(hslToRgb(c));

const contrastRatio = (a: number, b: number): number =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

const INK_LUMINANCE = {
  dark: rgbLuminance(hexToRgb(INK_ON_COLOR.dark)),
  light: rgbLuminance(hexToRgb(INK_ON_COLOR.light)),
};

/** Which `INK_ON_COLOR` entry reads better on `c`, by WCAG contrast ratio; ties go to dark. */
export const contrastInk = (c: Hsl): keyof typeof INK_ON_COLOR => {
  const y = relativeLuminance(c);
  return contrastRatio(y, INK_LUMINANCE.dark) >= contrastRatio(y, INK_LUMINANCE.light)
    ? "dark"
    : "light";
};
