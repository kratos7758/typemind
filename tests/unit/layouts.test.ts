import { describe, expect, it } from "vitest";
import { FINGER_BY_CODE, LAYOUTS, strokesFor, type LayoutId } from "@/features/typing-engine/layouts";

const ALL = Object.keys(LAYOUTS) as LayoutId[];
const COMMON = [..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,;:!?'\"-()\n"];

describe.each(ALL)("layout %s", (id) => {
  it("can type every common character", () => {
    const missing = COMMON.filter((ch) => strokesFor(id, ch) === null);
    expect(missing).toEqual([]);
  });

  it("assigns a finger to every key it defines", () => {
    for (const code of Object.keys(LAYOUTS[id].keys)) expect(FINGER_BY_CODE[code], code).toBeDefined();
  });

  it("uses the opposite hand's Shift", () => {
    const [a] = strokesFor(id, "A")!; // left hand on every supported layout
    expect(a.shift).toBe(true);
    expect(a.shiftCode).toBe("ShiftRight");
  });
});

describe("French layouts", () => {
  it.each(["fr-azerty", "ca-fr-csa", "ca-multi"] as const)("%s types French accents", (id) => {
    const missing = [..."éèàùçâêîôûëïüÊ"].filter((ch) => strokesFor(id, ch) === null);
    expect(missing).toEqual([]);
  });

  it("standard AZERTY has no way to type É (no acute dead key): no hint rather than a wrong one", () => {
    expect(strokesFor("fr-azerty", "É")).toBeNull();
    expect(strokesFor("ca-fr-csa", "É")).not.toBeNull();
  });

  it("AZERTY: a is on the QWERTY Q position, typed with the left pinky", () => {
    expect(strokesFor("fr-azerty", "a")).toEqual([
      { code: "KeyQ", shift: false, altgr: false, finger: "l-pinky", shiftCode: undefined },
    ]);
  });

  it("AZERTY: digits need Shift", () => {
    expect(strokesFor("fr-azerty", "1")?.[0]).toMatchObject({ code: "Digit1", shift: true });
  });

  it("AZERTY: ê is the circumflex dead key then e", () => {
    const strokes = strokesFor("fr-azerty", "ê")!;
    expect(strokes.map((s) => s.code)).toEqual(["BracketLeft", "KeyE"]);
  });

  it("AZERTY: Ê uses Shift on the second stroke", () => {
    const strokes = strokesFor("fr-azerty", "Ê")!;
    expect(strokes[1]).toMatchObject({ code: "KeyE", shift: true });
  });

  it("AZERTY: direct keys are preferred over dead-key compositions", () => {
    expect(strokesFor("fr-azerty", "è")).toHaveLength(1);
  });

  it("AZERTY: AltGr characters", () => {
    expect(strokesFor("fr-azerty", "@")?.[0]).toMatchObject({ code: "Digit0", altgr: true });
    expect(strokesFor("fr-azerty", "€")?.[0]).toMatchObject({ code: "KeyE", altgr: true });
  });

  it("CSA: French guillemets on AltGr", () => {
    expect(strokesFor("ca-fr-csa", "«")?.[0]).toMatchObject({ code: "KeyZ", altgr: true });
  });
});

describe("German layout", () => {
  it("types umlauts, ß and y/z swap", () => {
    expect(strokesFor("de-qwertz", "ü")?.[0].code).toBe("BracketLeft");
    expect(strokesFor("de-qwertz", "ß")?.[0].code).toBe("Minus");
    expect(strokesFor("de-qwertz", "z")?.[0].code).toBe("KeyY");
    expect(strokesFor("de-qwertz", "é")?.map((s) => s.code)).toEqual(["Equal", "KeyE"]);
  });
});

describe("unsupported characters", () => {
  it("return null instead of guessing", () => {
    expect(strokesFor("us-qwerty", "é")).toBeNull();
    expect(strokesFor("fr-azerty", "😀")).toBeNull();
  });
});
