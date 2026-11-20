/**
 * "What should I practice now — and why?" Deterministic rules (docs/ADAPTIVE-LEARNING.md §4).
 * Every recommendation carries a `reason` built from the user's actual data,
 * so the UI can explain it without inventing anything.
 */
import type { Locale } from "@/i18n/config";
import { LIBRARY } from "@/content/library";
import type { Lesson } from "@/content/lessons";
import type { TopicKey } from "@/content/topics";
import type { SkillLevel } from "./profile";
import type { Trend } from "./trends";

export type Reason =
  | { code: "no_assessment" }
  | { code: "course" }
  | { code: "low_accuracy"; accuracy: number }
  | { code: "weak_keys"; keys: string[] }
  | { code: "plateau" }
  | { code: "interests" };

export type Recommendation =
  | { kind: "assessment"; reason: Reason }
  | { kind: "lesson"; id: string; reason: Reason }
  | { kind: "text"; id: string; title: string; reason: Reason }
  | { kind: "accuracy"; id: string; title: string; reason: Reason }
  | { kind: "adaptive"; reason: Reason };

export type RecommendInput = {
  skillLevel: SkillLevel | null;
  experience: "never" | "beginner" | "intermediate" | "advanced" | null;
  lessons: readonly Lesson[];
  passedLessons: ReadonlySet<string>;
  contentLanguage: Locale;
  interests: readonly TopicKey[];
  /** Most recent first, e.g. ["lib:fr-science-1", "lesson:top-1"]. */
  recentExerciseKeys: readonly string[];
  currentAccuracy?: number | null;
  weakKeys?: readonly string[];
  weakBigrams?: readonly string[];
  wpmTrend?: Trend;
};

export const RECOMMEND_CONFIG = {
  /** Below this smoothed accuracy, accuracy training comes first. */
  accuracyFloor: 90,
  /** Adaptive practice is proposed unless one of the last N sessions already was. */
  adaptiveEvery: 3,
} as const;

const COURSE_LEVELS: ReadonlySet<SkillLevel> = new Set(["novice", "beginner"]);

function leastRecentText(input: RecommendInput) {
  const candidates = LIBRARY.filter(
    (t) => t.language === input.contentLanguage && (input.interests.length === 0 || input.interests.includes(t.topic)),
  );
  const pool = candidates.length ? candidates : LIBRARY.filter((t) => t.language === input.contentLanguage);
  const recency = (id: string) => {
    const index = input.recentExerciseKeys.findIndex((k) => k.endsWith(`:${id}`));
    return index === -1 ? Number.POSITIVE_INFINITY : index;
  };
  return [...pool].sort((a, b) => recency(b.id) - recency(a.id))[0];
}

export function recommend(input: RecommendInput): Recommendation {
  if (!input.skillLevel) return { kind: "assessment", reason: { code: "no_assessment" } };

  // The measured level wins over the declared one, except for people who type with two
  // fingers while looking ("never"): speed alone doesn't mean they touch-type, so they
  // keep the course until they reach an advanced level.
  const followsCourse =
    COURSE_LEVELS.has(input.skillLevel) || (input.experience === "never" && input.skillLevel === "intermediate");
  if (followsCourse) {
    const next = input.lessons.find((l) => !input.passedLessons.has(l.id));
    if (next) return { kind: "lesson", id: next.id, reason: { code: "course" } };
  }

  if (input.currentAccuracy != null && input.currentAccuracy < RECOMMEND_CONFIG.accuracyFloor) {
    const text = leastRecentText(input);
    return {
      kind: "accuracy",
      id: text.id,
      title: text.title,
      reason: { code: "low_accuracy", accuracy: Math.round(input.currentAccuracy) },
    };
  }

  const weak = [...(input.weakKeys ?? []), ...(input.weakBigrams ?? [])];
  const recentAdaptive = input.recentExerciseKeys
    .slice(0, RECOMMEND_CONFIG.adaptiveEvery)
    .some((k) => k.startsWith("adaptive:"));
  if (weak.length > 0 && !recentAdaptive) {
    return {
      kind: "adaptive",
      reason: input.wpmTrend === "stable" || input.wpmTrend === "declining"
        ? { code: "plateau" }
        : { code: "weak_keys", keys: weak.slice(0, 4) },
    };
  }

  const text = leastRecentText(input);
  return { kind: "text", id: text.id, title: text.title, reason: { code: "interests" } };
}
