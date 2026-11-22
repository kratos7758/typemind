import { describe, expect, it } from "vitest";
import { fingerTargets, handsPose, type Rect } from "@/features/typing-engine/hands";
import { ROWS, strokesFor } from "@/features/typing-engine/layouts";

/** Synthetic ISO-like grid: 40px keys, 4px gaps, rows staggered like the diagram. */
function grid(): Map<string, Rect> {
  const keys = new Map<string, Rect>();
  const row = (codes: readonly string[], y: number, x0: number) =>
    codes.forEach((c, i) => keys.set(c, { x: x0 + i * 44, y, w: 40, h: 40 }));
  row(ROWS.E, 0, 0);
  row(ROWS.D, 44, 66);
  row(ROWS.C, 88, 77);
  row(["IntlBackslash", ...ROWS.B], 132, 55);
  keys.set("ShiftLeft", { x: 0, y: 132, w: 51, h: 40 });
  keys.set("ShiftRight", { x: 539, y: 132, w: 121, h: 40 });
  keys.set("Space", { x: 165, y: 176, w: 275, h: 40 });
  keys.set("AltRight", { x: 444, y: 176, w: 55, h: 40 });
  return keys;
}

const tipOf = (pose: ReturnType<typeof handsPose>, finger: string) =>
  pose!.flatMap((h) => h.fingers).find((f) => f.finger === finger)!;
const centerOf = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

describe("guide hands", () => {
  it("rests on the home row with no finger highlighted", () => {
    const keys = grid();
    const pose = handsPose(keys, null)!;
    expect(pose).toHaveLength(2);
    expect(tipOf(pose, "l-index").tip).toEqual(centerOf(keys.get("KeyF")!));
    expect(tipOf(pose, "r-pinky").tip).toEqual(centerOf(keys.get("Semicolon")!));
    expect(pose.flatMap((h) => h.fingers).some((f) => f.active)).toBe(false);
  });

  it("AZERTY 'a' is typed with the left pinky on the physical Q key", () => {
    const keys = grid();
    const pose = handsPose(keys, strokesFor("fr-azerty", "a"))!;
    const pinky = tipOf(pose, "l-pinky");
    expect(pinky.active).toBe(true);
    expect(pinky.tip).toEqual(centerOf(keys.get("KeyQ")!));
    expect(pose.flatMap((h) => h.fingers).filter((f) => f.active)).toHaveLength(1);
  });

  it("a capital uses the Shift of the other hand", () => {
    const targets = fingerTargets(strokesFor("us-qwerty", "J"));
    expect(targets.get("r-index")).toBe("KeyJ");
    expect(targets.get("l-pinky")).toBe("ShiftLeft");
  });

  it("AltGr characters move the right thumb to AltGr", () => {
    const targets = fingerTargets(strokesFor("fr-azerty", "@"));
    expect(targets.get("r-thumb")).toBe("AltRight");
  });

  it("space is shown on both thumbs, each on its own side of the bar", () => {
    const keys = grid();
    const pose = handsPose(keys, strokesFor("fr-azerty", " "))!;
    const left = tipOf(pose, "l-thumb");
    const right = tipOf(pose, "r-thumb");
    expect(left.active && right.active).toBe(true);
    expect(left.tip.x).toBeLessThan(right.tip.x);
  });

  it("waits for measurements before drawing", () => {
    expect(handsPose(new Map(), null)).toBeNull();
  });
});
