/**
 * Learning profile rules — deterministic and pure (no DB, no AI).
 * All thresholds are in LEARNING_CONFIG so they can be tuned and tested (docs/ADAPTIVE-LEARNING.md).
 */
import type { SessionMode } from "@/features/sessions/schema";

export const LEARNING_CONFIG = {
  /** Weight of the newest session in moving averages (0–1). */
  ewmaAlpha: 0.3,
  /** Sessions shorter than this don't move the speed/accuracy profile. */
  minKeystrokesForProfile: 30,
  /** Lessons use drills/pseudo-words: their speed is not representative. */
  profileModes: ["assessment", "adaptive", "ai_text", "speed_test", "accuracy"] as SessionMode[],
  weakKey: { minAttempts: 15, minErrorRate: 0.05, max: 6 },
  weakBigram: { minAttempts: 8, minErrorRate: 0.08, max: 6 },
  /** [minimum net WPM, level] — first match from the top. */
  levels: [
    [75, "expert"],
    [50, "advanced"],
    [30, "intermediate"],
    [15, "beginner"],
    [0, "novice"],
  ] as const,
  /** Below this accuracy, the assessed level is lowered by one step. */
  assessmentAccuracyFloor: 85,
  /** An assessment is unreliable (offer a retake) under these values. */
  reliableAssessment: { minKeystrokes: 60, minAccuracy: 75 },
} as const;

export type SkillLevel = "novice" | "beginner" | "intermediate" | "advanced" | "expert";
const LEVEL_ORDER: SkillLevel[] = ["novice", "beginner", "intermediate", "advanced", "expert"];

export const ewma = (previous: number | null, value: number, alpha: number = LEARNING_CONFIG.ewmaAlpha) =>
  previous === null ? value : alpha * value + (1 - alpha) * previous;

export function classifyLevel(netWpm: number, accuracy: number): SkillLevel {
  const [, level] = LEARNING_CONFIG.levels.find(([min]) => netWpm >= min) ?? [0, "novice"];
  if (accuracy < LEARNING_CONFIG.assessmentAccuracyFloor) {
    return LEVEL_ORDER[Math.max(0, LEVEL_ORDER.indexOf(level) - 1)];
  }
  return level;
}

export function isReliableAssessment(keystrokes: number, accuracy: number): boolean {
  const { minKeystrokes, minAccuracy } = LEARNING_CONFIG.reliableAssessment;
  return keystrokes >= minKeystrokes && accuracy >= minAccuracy;
}

/** Suggested speed goal: current speed + 15, rounded to 5, at least 20 WPM. */
export const suggestTargetWpm = (netWpm: number) => Math.max(20, Math.round((netWpm + 15) / 5) * 5);

/** Calendar date (YYYY-MM-DD) of an instant in a time zone; falls back to UTC on invalid zones. */
export function localDate(instant: Date, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timeZone ?? "UTC" }).format(instant);
  } catch {
    return instant.toISOString().slice(0, 10);
  }
}

/** Consecutive practice days, given the previous practice instant. */
export function nextStreak(
  previousStreak: number,
  lastPracticeAt: Date | null,
  now: Date,
  timeZone?: string,
): number {
  if (!lastPracticeAt) return 1;
  const today = localDate(now, timeZone);
  const last = localDate(lastPracticeAt, timeZone);
  if (last === today) return Math.max(1, previousStreak);
  const yesterday = localDate(new Date(now.getTime() - 24 * 3600_000), timeZone);
  return last === yesterday ? previousStreak + 1 : 1;
}

export type StatRow = { key: string; attempts: number; ewmaErrorRate: number | null };

/** Worst keys first, only with enough evidence (avoids flagging a key after one typo). */
export function pickWeak(rows: readonly StatRow[], rule: { minAttempts: number; minErrorRate: number; max: number }) {
  return rows
    .filter((r) => r.key.trim() !== "" && r.attempts >= rule.minAttempts && (r.ewmaErrorRate ?? 0) >= rule.minErrorRate)
    .sort((a, b) => (b.ewmaErrorRate ?? 0) - (a.ewmaErrorRate ?? 0))
    .slice(0, rule.max)
    .map((r) => r.key);
}

export type ProfileState = {
  currentWpm: number | null;
  currentAccuracy: number | null;
  streakDays: number;
  lastPracticeAt: Date | null;
  skillLevel: SkillLevel | null;
  targetWpm: number | null;
  assessedAt: Date | null;
};

export type SessionFacts = {
  mode: SessionMode;
  netWpm: number;
  accuracy: number;
  keystrokes: number;
  endedAt: Date;
  timeZone?: string;
};

/** New profile values after a session (weak keys are computed separately from aggregated stats). */
export function updateProfile(state: ProfileState, s: SessionFacts): ProfileState {
  const next: ProfileState = {
    ...state,
    streakDays: nextStreak(state.streakDays, state.lastPracticeAt, s.endedAt, s.timeZone),
    lastPracticeAt: s.endedAt,
  };

  const counts =
    LEARNING_CONFIG.profileModes.includes(s.mode) && s.keystrokes >= LEARNING_CONFIG.minKeystrokesForProfile;
  if (counts) {
    next.currentWpm = Math.round(ewma(state.currentWpm, s.netWpm) * 10) / 10;
    next.currentAccuracy = Math.round(ewma(state.currentAccuracy, s.accuracy) * 10) / 10;
  }

  if (s.mode === "assessment" && isReliableAssessment(s.keystrokes, s.accuracy)) {
    // The assessment resets the speed baseline instead of blending into older data.
    next.currentWpm = s.netWpm;
    next.currentAccuracy = s.accuracy;
    next.skillLevel = classifyLevel(s.netWpm, s.accuracy);
    next.targetWpm = state.targetWpm ?? suggestTargetWpm(s.netWpm);
    next.assessedAt = s.endedAt;
  }
  return next;
}
