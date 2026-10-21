import { describe, expect, it } from "vite-plus/test";
import { axisOf, type Face, START_FACE, type TurnAxis, turn, VARIABLES } from "./cube";

const ALL_FACES: Face[] = [
  { depth: "l", x: "h", y: "s" },
  { depth: "l", x: "s", y: "h" },
  { depth: "s", x: "h", y: "l" },
  { depth: "s", x: "l", y: "h" },
  { depth: "h", x: "s", y: "l" },
  { depth: "h", x: "l", y: "s" },
];

const key = (f: Face) => `${f.depth}${f.x}${f.y}`;

describe("turn", () => {
  it("visits all six faces alternating horizontal and vertical, then returns to START_FACE", () => {
    let face = START_FACE;
    const seen = [key(face)];
    for (let i = 0; i < 6; i++) {
      face = turn(face, i % 2 === 0 ? "horizontal" : "vertical");
      seen.push(key(face));
    }
    expect(face).toEqual(START_FACE);
    expect(new Set(seen.slice(0, 6))).toEqual(new Set(ALL_FACES.map(key)));
  });

  it.each(
    ALL_FACES.flatMap((f) =>
      (["horizontal", "vertical"] as TurnAxis[]).map((a) => [f, a] as const),
    ),
  )("turning %j %s twice is the identity", (face, axis) => {
    expect(turn(turn(face, axis), axis)).toEqual(face);
  });

  it("horizontal keeps y, vertical keeps x", () => {
    expect(turn(START_FACE, "horizontal")).toEqual({ depth: "h", x: "l", y: "s" });
    expect(turn(START_FACE, "vertical")).toEqual({ depth: "s", x: "h", y: "l" });
  });
});

describe("axisOf", () => {
  it.each([
    ["left", "horizontal"],
    ["right", "horizontal"],
    ["up", "vertical"],
    ["down", "vertical"],
  ] as const)("%s → %s", (direction, axis) => {
    expect(axisOf(direction)).toBe(axis);
  });
});

describe("VARIABLES", () => {
  it("only hue wraps", () => {
    expect(VARIABLES.h).toMatchObject({ max: 360, wraps: true, unit: "°" });
    expect(VARIABLES.s).toMatchObject({ max: 100, wraps: false, unit: "%" });
    expect(VARIABLES.l).toMatchObject({ max: 100, wraps: false, unit: "%" });
  });
});
