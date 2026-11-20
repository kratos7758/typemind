import { describe, expect, it } from "vitest";
import {
  classifyLevel,
  ewma,
  isReliableAssessment,
  localDate,
  nextStreak,
  pickWeak,
  suggestTargetWpm,
  updateProfile,
  type ProfileState,
} from "@/features/learning/profile";

const empty: ProfileState = {
  currentWpm: null,
  currentAccuracy: null,
  streakDays: 0,
  lastPracticeAt: null,
  skillLevel: null,
  targetWpm: null,
  assessedAt: null,
};

const at = (iso: string) => new Date(iso);

describe("levels", () => {
  it.each([
    [10, 98, "novice"],
    [20, 98, "beginner"],
    [40, 98, "intermediate"],
    [60, 98, "advanced"],
    [90, 98, "expert"],
    [40, 80, "beginner"], // low accuracy lowers the level
    [10, 50, "novice"], // never below novice
  ])("%s WPM at %s%% → %s", (wpm, acc, level) => {
    expect(classifyLevel(wpm, acc)).toBe(level);
  });

  it("flags short or very inaccurate assessments as unreliable", () => {
    expect(isReliableAssessment(200, 95)).toBe(true);
    expect(isReliableAssessment(40, 95)).toBe(false);
    expect(isReliableAssessment(200, 60)).toBe(false);
  });

  it("suggests a reachable target", () => {
    expect(suggestTargetWpm(0)).toBe(20);
    expect(suggestTargetWpm(32)).toBe(45);
  });
});

describe("ewma", () => {
  it("starts from the first value then smooths", () => {
    expect(ewma(null, 40)).toBe(40);
    expect(ewma(40, 50)).toBeCloseTo(43);
  });
});

describe("streaks", () => {
  it("counts consecutive local days", () => {
    expect(nextStreak(0, null, at("2026-11-18T12:00:00Z"))).toBe(1);
    expect(nextStreak(3, at("2026-11-18T12:00:00Z"), at("2026-11-18T20:00:00Z"))).toBe(3);
    expect(nextStreak(3, at("2026-11-17T12:00:00Z"), at("2026-11-18T12:00:00Z"))).toBe(4);
    expect(nextStreak(3, at("2026-11-15T12:00:00Z"), at("2026-11-18T12:00:00Z"))).toBe(1);
  });

  it("uses the user's time zone, not UTC", () => {
    // 23:30 in Montreal on Nov 17 is already Nov 18 in UTC.
    const lastEvening = at("2026-11-18T04:30:00Z");
    const nextMorning = at("2026-11-18T13:00:00Z");
    expect(localDate(lastEvening, "America/Toronto")).toBe("2026-11-17");
    expect(nextStreak(1, lastEvening, nextMorning, "America/Toronto")).toBe(2);
    expect(nextStreak(1, lastEvening, nextMorning, "UTC")).toBe(1);
  });

  it("falls back to UTC on an invalid time zone", () => {
    expect(localDate(at("2026-11-18T04:30:00Z"), "Not/AZone")).toBe("2026-11-18");
  });
});

describe("pickWeak", () => {
  it("needs enough attempts and a meaningful error rate", () => {
    const rows = [
      { key: "r", attempts: 40, ewmaErrorRate: 0.2 },
      { key: "t", attempts: 40, ewmaErrorRate: 0.1 },
      { key: "z", attempts: 3, ewmaErrorRate: 0.9 }, // not enough evidence
      { key: "a", attempts: 100, ewmaErrorRate: 0.01 }, // fine
      { key: " ", attempts: 100, ewmaErrorRate: 0.3 }, // space excluded
    ];
    expect(pickWeak(rows, { minAttempts: 15, minErrorRate: 0.05, max: 6 })).toEqual(["r", "t"]);
  });
});

describe("updateProfile", () => {
  const base = { netWpm: 40, accuracy: 95, keystrokes: 300, endedAt: at("2026-11-18T12:00:00Z") };

  it("a reliable assessment sets level, baseline and target", () => {
    const p = updateProfile({ ...empty, currentWpm: 10 }, { ...base, mode: "assessment" });
    expect(p).toMatchObject({ skillLevel: "intermediate", currentWpm: 40, targetWpm: 55, streakDays: 1 });
    expect(p.assessedAt).toEqual(base.endedAt);
  });

  it("an unreliable assessment does not set a level", () => {
    const p = updateProfile(empty, { ...base, mode: "assessment", keystrokes: 20 });
    expect(p.skillLevel).toBeNull();
  });

  it("lessons update the streak but not the speed profile", () => {
    const p = updateProfile({ ...empty, currentWpm: 30 }, { ...base, mode: "lesson", netWpm: 5 });
    expect(p.currentWpm).toBe(30);
    expect(p.streakDays).toBe(1);
  });

  it("speed tests blend into the profile", () => {
    const p = updateProfile({ ...empty, currentWpm: 30, currentAccuracy: 90 }, { ...base, mode: "speed_test" });
    expect(p.currentWpm).toBe(33);
    expect(p.currentAccuracy).toBe(91.5);
  });

  it("keeps a user-chosen target", () => {
    const p = updateProfile({ ...empty, targetWpm: 80 }, { ...base, mode: "assessment" });
    expect(p.targetWpm).toBe(80);
  });
});
