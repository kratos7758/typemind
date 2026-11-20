import { describe, expect, it } from "vitest";
import { adaptiveText, targetScore, vocabulary } from "@/features/learning/adaptive";
import { computeTrend } from "@/features/learning/trends";
import { recommend, type RecommendInput } from "@/features/learning/recommend";
import { lessonsFor } from "@/content/lessons";

describe("computeTrend", () => {
  it("needs two full windows", () => {
    expect(computeTrend([30, 31, 32], 2)).toBe("unknown");
  });
  it.each([
    [[30, 30, 30, 30, 30, 34, 35, 33, 34, 36], "improving"],
    [[30, 31, 30, 29, 30, 30, 31, 29, 30, 31], "stable"],
    [[40, 41, 40, 42, 41, 36, 37, 35, 38, 36], "declining"],
  ] as const)("%j → %s", (values, trend) => {
    expect(computeTrend(values, 2)).toBe(trend);
  });
  it("ignores a single outlier session", () => {
    expect(computeTrend([30, 30, 30, 30, 30, 30, 30, 30, 30, 38], 2)).toBe("stable"); // +1.6 mean
  });
});

describe("adaptive drill", () => {
  it("scores bigrams higher than single keys", () => {
    expect(targetScore("très", ["r"], ["tr"])).toBe(3);
    expect(targetScore("chat", ["r"], ["tr"])).toBe(0);
  });

  it("mostly uses words containing the targets", () => {
    const text = adaptiveText("fr", { keys: ["r"], bigrams: ["tr"] }, 42);
    const words = text.split(" ");
    expect(words).toHaveLength(45);
    const withTarget = words.filter((w) => w.includes("r")).length;
    expect(withTarget / words.length).toBeGreaterThan(0.5);
  });

  it("uses real vocabulary only and is reproducible", () => {
    const vocab = new Set(vocabulary("en"));
    const text = adaptiveText("en", { keys: ["p", "y"], bigrams: [] }, 7);
    expect(text.split(" ").every((w) => vocab.has(w))).toBe(true);
    expect(adaptiveText("en", { keys: ["p", "y"], bigrams: [] }, 7)).toBe(text);
  });

  it("returns an empty string when nothing matches", () => {
    expect(adaptiveText("en", { keys: ["#"], bigrams: [] }, 1)).toBe("");
  });
});

const base: RecommendInput = {
  skillLevel: "intermediate",
  experience: "intermediate",
  lessons: lessonsFor("fr-azerty"),
  passedLessons: new Set(),
  contentLanguage: "fr",
  interests: ["science"],
  recentExerciseKeys: [],
  currentAccuracy: 95,
  weakKeys: ["r", "t"],
  weakBigrams: ["tr"],
  wpmTrend: "improving",
};

describe("recommend (phase 3 rules)", () => {
  it("low accuracy comes first, with the measured value as reason", () => {
    expect(recommend({ ...base, currentAccuracy: 86.4 })).toMatchObject({
      kind: "accuracy",
      reason: { code: "low_accuracy", accuracy: 86 },
    });
  });

  it("targets weak keys when no recent adaptive session", () => {
    expect(recommend(base)).toMatchObject({ kind: "adaptive", reason: { code: "weak_keys", keys: ["r", "t", "tr"] } });
  });

  it("explains a plateau", () => {
    expect(recommend({ ...base, wpmTrend: "stable" }).reason).toEqual({ code: "plateau" });
  });

  it("alternates: after an adaptive session, proposes an interest text", () => {
    const r = recommend({ ...base, recentExerciseKeys: ["lib:fr-finance-1", "adaptive:weak"] });
    expect(r).toMatchObject({ kind: "text", reason: { code: "interests" } });
  });

  it("without weak keys, proposes an interest text", () => {
    expect(recommend({ ...base, weakKeys: [], weakBigrams: [] }).kind).toBe("text");
  });
});
