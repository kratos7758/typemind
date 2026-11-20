import { describe, expect, it } from "vitest";
import { nextLessonId, practiceText, resolvePractice } from "@/features/practice/config";
import { sessionPayloadSchema } from "@/features/sessions/schema";

const user = { layoutId: "fr-azerty" as const, contentLanguage: "fr" as const };

describe("resolvePractice", () => {
  it.each([
    ["lesson", "home-index", "lesson:home-index", "lesson", true],
    ["speed", "60", "speed:60", "speed_test", false],
    ["text", "fr-science-1", "lib:fr-science-1", "adaptive", false],
    ["accuracy", "fr-science-1", "accuracy:fr-science-1", "accuracy", true],
    ["assessment", "fr", "assessment:fr", "assessment", false],
  ])("%s/%s", (kind, id, key, mode, stopOnError) => {
    const c = resolvePractice(kind, id, user)!;
    expect(c).toMatchObject({ exerciseKey: key, mode, stopOnError });
    // Every exercise key must pass the server-side payload validation.
    expect(sessionPayloadSchema.shape.exerciseKey.safeParse(key).success).toBe(true);
  });

  it.each([
    ["lesson", "nope"],
    ["speed", "45"],
    ["text", "../etc"],
    ["assessment", "de"],
    ["unknown", "x"],
  ])("rejects %s/%s", (kind, id) => {
    expect(resolvePractice(kind, id, user)).toBeNull();
  });

  it("timed exercises carry their duration", () => {
    expect(resolvePractice("speed", "30", user)!.limit).toEqual({ type: "time", durationMs: 30_000 });
    expect(resolvePractice("assessment", "en", user)!.limit).toEqual({ type: "time", durationMs: 60_000 });
  });
});

describe("practiceText", () => {
  it("speed tests have enough words and vary with the seed", () => {
    const c = resolvePractice("speed", "60", user)!;
    const a = practiceText(c, 0, 1);
    expect(a.split(" ").length).toBe(180);
    expect(practiceText(c, 0, 2)).not.toBe(a);
    expect(practiceText(c, 0, 1)).toBe(a);
  });

  it("assessment text is the same for everyone", () => {
    const c = resolvePractice("assessment", "fr", user)!;
    expect(practiceText(c, 0, 1)).toBe(practiceText(c, 3, 99));
  });
});

describe("nextLessonId", () => {
  it("returns the following lesson or null at the end", () => {
    expect(nextLessonId("fr-azerty", "home-index")).toBe("home-middle");
    expect(nextLessonId("fr-azerty", "sentences")).toBeNull();
  });
});
