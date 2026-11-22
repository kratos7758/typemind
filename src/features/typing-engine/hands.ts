import type { Finger, Stroke } from "./layouts";

/**
 * Geometry of the guide hands drawn over the keyboard diagram. Pure: takes measured key
 * rectangles and the next strokes, returns where each finger rests or reaches.
 * Fingers rest on the home row (by physical code, so every layout works); the finger(s)
 * needed for the next character reach the target key, Shift or AltGr included.
 */

export type Rect = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };
export type HandFinger = Exclude<Finger, "thumb"> | "l-thumb" | "r-thumb";

export type FingerPose = { finger: HandFinger; base: Point; tip: Point; radius: number; active: boolean };
export type HandPose = { side: "l" | "r"; palm: Point[]; fingers: FingerPose[] };

/** Home-row key under each fingertip. Thumbs rest on Space, below these keys. */
const HOME: Record<Exclude<HandFinger, "l-thumb" | "r-thumb">, string> = {
  "l-pinky": "KeyA",
  "l-ring": "KeyS",
  "l-middle": "KeyD",
  "l-index": "KeyF",
  "r-index": "KeyJ",
  "r-middle": "KeyK",
  "r-ring": "KeyL",
  "r-pinky": "Semicolon",
};
const THUMB_ABOVE = { "l-thumb": "KeyV", "r-thumb": "KeyM" } as const;

/** In key widths: finger length from fingertip (home key centre) to knuckle, and radius. */
const SHAPE = {
  pinky: { length: 2.2, radius: 0.33 },
  ring: { length: 2.7, radius: 0.36 },
  middle: { length: 2.9, radius: 0.37 },
  index: { length: 2.6, radius: 0.38 },
  thumb: { radius: 0.42 },
} as const;

const center = (r: Rect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** Which finger reaches which key for the next character (first stroke wins). */
export function fingerTargets(strokes: readonly Stroke[] | null): Map<HandFinger, string> {
  const targets = new Map<HandFinger, string>();
  const reach = (finger: HandFinger, code: string) => {
    if (!targets.has(finger)) targets.set(finger, code);
  };
  for (const s of strokes ?? []) {
    if (s.finger === "thumb") {
      if (s.code === "AltRight") reach("r-thumb", "AltRight");
      else {
        // Space: either thumb is correct.
        reach("l-thumb", s.code);
        reach("r-thumb", s.code);
      }
    } else {
      reach(s.finger, s.code);
    }
    if (s.shift && s.shiftCode) reach(s.shiftCode === "ShiftLeft" ? "l-pinky" : "r-pinky", s.shiftCode);
    if (s.altgr) reach("r-thumb", "AltRight");
  }
  return targets;
}

export function handsPose(keys: ReadonlyMap<string, Rect>, strokes: readonly Stroke[] | null): HandPose[] | null {
  const unit = keys.get("KeyF")?.w;
  const space = keys.get("Space");
  if (!unit || !space) return null;
  for (const code of [...Object.values(HOME), ...Object.values(THUMB_ABOVE)]) if (!keys.has(code)) return null;

  const targets = fingerTargets(strokes);
  const tipFor = (finger: HandFinger, rest: Point): Point => {
    const code = targets.get(finger);
    const rect = code ? keys.get(code) : undefined;
    if (!rect) return rest;
    // Space and wide keys: reach the part of the key nearest to the resting finger.
    const c = center(rect);
    return { x: Math.min(Math.max(rest.x, rect.x + unit / 2), rect.x + rect.w - unit / 2), y: c.y };
  };

  return (["l", "r"] as const).map((side) => {
    const names = (["pinky", "ring", "middle", "index"] as const).map((n) => `${side}-${n}` as const);
    const rests = names.map((n) => center(keys.get(HOME[n])!));
    const middleX = (rests[0].x + rests[3].x) / 2;

    const fingers: FingerPose[] = names.map((finger, i) => {
      const kind = (["pinky", "ring", "middle", "index"] as const)[i];
      const rest = rests[i];
      const base = { x: rest.x + (middleX - rest.x) * 0.15, y: rest.y + SHAPE[kind].length * unit };
      return { finger, base, tip: tipFor(finger, rest), radius: SHAPE[kind].radius * unit, active: targets.has(finger) };
    });

    const index = fingers[3];
    const pinky = fingers[0];
    const inward = side === "l" ? 1 : -1; // towards the middle of the keyboard
    const thumbName = `${side}-thumb` as const;
    const thumbRest = { x: center(keys.get(THUMB_ABOVE[thumbName])!).x, y: center(space).y };
    const thumbBase = { x: index.base.x + inward * 0.1 * unit, y: index.base.y + 0.9 * unit };
    fingers.push({
      finger: thumbName,
      base: thumbBase,
      tip: tipFor(thumbName, thumbRest),
      radius: SHAPE.thumb.radius * unit,
      active: targets.has(thumbName),
    });

    // Palm: knuckles on top, narrowing towards the wrist (usually below the visible area).
    const wristY = Math.max(...fingers.map((f) => f.base.y)) + 2.4 * unit;
    const palm: Point[] = [
      { x: pinky.base.x - inward * pinky.radius, y: pinky.base.y },
      ...fingers.slice(0, 4).map((f) => ({ x: f.base.x, y: f.base.y - f.radius * 0.5 })),
      { x: index.base.x + inward * index.radius, y: index.base.y },
      { x: thumbBase.x + inward * SHAPE.thumb.radius * unit, y: thumbBase.y },
      { x: index.base.x - inward * 0.1 * unit, y: wristY },
      { x: pinky.base.x + inward * 0.4 * unit, y: wristY },
    ];
    return { side, palm, fingers };
  });
}
