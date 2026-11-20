/**
 * Maps a practice URL (/app/practice/[kind]/[id]) to an exercise configuration.
 * Pure: runs on the server for the first render and in the browser for retries.
 */
import { isLocale, type Locale } from "@/i18n/config";
import type { LayoutId } from "@/features/typing-engine/layouts";
import type { SessionMode } from "@/features/sessions/schema";
import { prepareText } from "@/features/typing-engine/text";
import { getLesson, lessonText, lessonsFor } from "@/content/lessons";
import { ASSESSMENT_TEXT, getLibraryText } from "@/content/library";
import { COMMON_WORDS, randomWords, seededRandom } from "@/content/words";
import { adaptiveText, hasTargets, type AdaptiveTargets } from "@/features/learning/adaptive";

export const PRACTICE_KINDS = ["lesson", "speed", "text", "accuracy", "assessment", "adaptive", "ai"] as const;
export type PracticeKind = (typeof PRACTICE_KINDS)[number];
export const SPEED_DURATIONS = [15, 30, 60, 120, 300] as const;
export const ASSESSMENT_SECONDS = 60;

export type PracticeConfig = {
  kind: PracticeKind;
  id: string;
  mode: SessionMode;
  exerciseKey: string;
  layoutId: LayoutId;
  language: Locale;
  limit: { type: "text" } | { type: "time"; durationMs: number };
  stopOnError: boolean;
  /** Library title for texts; lessons/speed tests are named by the UI dictionary. */
  title: string | null;
  /** Weak keys / bigrams targeted by an adaptive drill. */
  targets?: AdaptiveTargets;
  /** Text stored in the database (AI exercises). */
  fixedText?: string;
  /** Short explanation shown before an AI exercise. */
  explanation?: string | null;
};

/** Data the server resolves before building a config (profile targets, stored AI exercise). */
export type PracticeContext = {
  targets?: AdaptiveTargets;
  aiExercise?: { id: string; title: string; body: string; language: Locale; explanation?: string | null } | null;
};

export function resolvePractice(
  kind: string,
  id: string,
  user: { layoutId: LayoutId; contentLanguage: Locale },
  context: PracticeContext = {},
): PracticeConfig | null {
  const base = { id, layoutId: user.layoutId, title: null };
  switch (kind) {
    case "lesson":
      if (!getLesson(user.layoutId, id)) return null;
      return {
        ...base,
        kind,
        mode: "lesson",
        exerciseKey: `lesson:${id}`,
        language: user.contentLanguage,
        limit: { type: "text" },
        stopOnError: true,
      };
    case "speed": {
      const seconds = Number(id);
      if (!(SPEED_DURATIONS as readonly number[]).includes(seconds)) return null;
      return {
        ...base,
        kind,
        mode: "speed_test",
        exerciseKey: `speed:${seconds}`,
        language: user.contentLanguage,
        limit: { type: "time", durationMs: seconds * 1000 },
        stopOnError: false,
      };
    }
    case "text":
    case "accuracy": {
      const text = getLibraryText(id);
      if (!text) return null;
      return {
        ...base,
        kind,
        mode: kind === "text" ? "adaptive" : "accuracy",
        exerciseKey: `${kind === "text" ? "lib" : "accuracy"}:${id}`,
        language: text.language,
        limit: { type: "text" },
        stopOnError: kind === "accuracy",
        title: text.title,
      };
    }
    case "assessment":
      if (!isLocale(id)) return null;
      return {
        ...base,
        kind,
        mode: "assessment",
        exerciseKey: `assessment:${id}`,
        language: id,
        limit: { type: "time", durationMs: ASSESSMENT_SECONDS * 1000 },
        stopOnError: false,
      };
    case "adaptive":
      if (id !== "weak" || !context.targets || !hasTargets(context.targets)) return null;
      return {
        ...base,
        kind,
        mode: "adaptive",
        exerciseKey: "adaptive:weak",
        language: user.contentLanguage,
        limit: { type: "text" },
        stopOnError: false,
        targets: context.targets,
      };
    case "ai": {
      const ex = context.aiExercise;
      if (!ex || ex.id !== id) return null;
      return {
        ...base,
        kind,
        mode: "ai_text",
        exerciseKey: `ai:${id}`,
        language: ex.language,
        limit: { type: "text" },
        stopOnError: false,
        title: ex.title,
        fixedText: ex.body,
        explanation: ex.explanation ?? null,
      };
    }
    default:
      return null;
  }
}

/** Text for an attempt. `seed` only matters for randomized exercises (speed tests). */
export function practiceText(config: PracticeConfig, attempt: number, seed: number): string {
  switch (config.kind) {
    case "lesson":
      return lessonText(config.layoutId, config.language, config.id, attempt);
    case "speed": {
      const seconds = config.limit.type === "time" ? config.limit.durationMs / 1000 : 60;
      // Enough words for ~180 WPM so fast typists never run out.
      return randomWords(COMMON_WORDS[config.language], Math.ceil(seconds * 3), seededRandom(seed + attempt));
    }
    case "text":
    case "accuracy":
      return prepareText(getLibraryText(config.id)!.body);
    case "assessment":
      return ASSESSMENT_TEXT[config.language];
    case "adaptive":
      return adaptiveText(config.language, config.targets ?? { keys: [], bigrams: [] }, seed + attempt);
    case "ai":
      return prepareText(config.fixedText ?? "");
  }
}

export function nextLessonId(layoutId: LayoutId, currentId: string): string | null {
  const lessons = lessonsFor(layoutId);
  const index = lessons.findIndex((l) => l.id === currentId);
  return index >= 0 && index < lessons.length - 1 ? lessons[index + 1].id : null;
}
