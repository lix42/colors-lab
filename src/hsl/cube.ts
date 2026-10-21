export type Variable = "h" | "s" | "l";

/** Which variable is on the slider (depth) and on each grid axis; all three distinct. */
export type Face = { depth: Variable; x: Variable; y: Variable };

export const START_FACE: Face = { depth: "l", x: "h", y: "s" };

export const VARIABLES: Record<
  Variable,
  { name: string; unit: "°" | "%"; max: number; wraps: boolean }
> = {
  h: { name: "Hue", unit: "°", max: 360, wraps: true },
  s: { name: "Saturation", unit: "%", max: 100, wraps: false },
  l: { name: "Lightness", unit: "%", max: 100, wraps: false },
};

export type TurnAxis = "horizontal" | "vertical";

/** Only the animation uses the direction; opposite directions give the same face. */
export type TurnDirection = "left" | "right" | "up" | "down";

/** Horizontal keeps y and swaps depth with x; vertical keeps x and swaps depth with y. */
export const turn = (face: Face, axis: TurnAxis): Face =>
  axis === "horizontal"
    ? { depth: face.x, x: face.depth, y: face.y }
    : { depth: face.y, x: face.x, y: face.depth };

export const axisOf = (direction: TurnDirection): TurnAxis =>
  direction === "left" || direction === "right" ? "horizontal" : "vertical";
