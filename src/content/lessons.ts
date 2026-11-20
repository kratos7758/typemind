/**
 * Beginner course, defined by PHYSICAL key positions so it works on every layout:
 * lesson 1 is always "the two index-finger home keys", whatever letters they carry.
 * Drill text is generated from the letters available so far (seeded, reproducible).
 */
import type { Locale } from "@/i18n/config";
import { LAYOUTS, type LayoutId } from "@/features/typing-engine/layouts";
import { getLibraryText, LIBRARY } from "./library";
import { COMMON_WORDS, randomWords, seededRandom } from "./words";

export type LessonKind = "keys" | "special" | "capitals" | "numbers" | "punctuation" | "sentences";
export type Lesson = { id: string; kind: LessonKind; newCodes: readonly string[] };

const KEY_LESSONS: [string, string[]][] = [
  ["home-index", ["KeyF", "KeyJ"]],
  ["home-middle", ["KeyD", "KeyK"]],
  ["home-ring", ["KeyS", "KeyL"]],
  ["home-pinky", ["KeyA", "Semicolon"]],
  ["home-center", ["KeyG", "KeyH"]],
  ["top-1", ["KeyE", "KeyI"]],
  ["top-2", ["KeyR", "KeyU"]],
  ["top-3", ["KeyT", "KeyY"]],
  ["top-4", ["KeyW", "KeyO"]],
  ["top-5", ["KeyQ", "KeyP"]],
  ["bottom-1", ["KeyV", "KeyM"]],
  ["bottom-2", ["KeyB", "KeyN"]],
  ["bottom-3", ["KeyC", "Comma"]],
  ["bottom-4", ["KeyX", "Period"]],
  ["bottom-5", ["KeyZ", "Slash"]],
];

const isLetter = (s: string | undefined): s is string => !!s && /^\p{L}$/u.test(s);

/** Lessons available for a layout (the "special letters" lesson only exists when relevant). */
export function lessonsFor(layoutId: LayoutId): Lesson[] {
  const layout = LAYOUTS[layoutId];
  const covered = new Set(KEY_LESSONS.flatMap(([, codes]) => codes));
  const specialCodes = Object.entries(layout.keys)
    .filter(([code, levels]) => !covered.has(code) && isLetter(levels[0]))
    .map(([code]) => code);

  return [
    ...KEY_LESSONS.map(([id, newCodes]) => ({ id, kind: "keys" as const, newCodes })),
    ...(specialCodes.length ? [{ id: "special-letters", kind: "special" as const, newCodes: specialCodes }] : []),
    { id: "capitals", kind: "capitals", newCodes: [] },
    { id: "numbers", kind: "numbers", newCodes: [] },
    { id: "punctuation", kind: "punctuation", newCodes: [] },
    { id: "sentences", kind: "sentences", newCodes: [] },
  ];
}

export const getLesson = (layoutId: LayoutId, id: string) => lessonsFor(layoutId).find((l) => l.id === id);

/** Letters produced (base level) by the given physical keys on a layout. */
export function lettersOf(layoutId: LayoutId, codes: readonly string[]): string[] {
  return codes.map((c) => LAYOUTS[layoutId].keys[c]?.[0]).filter(isLetter);
}

function cumulativeCodes(layoutId: LayoutId, lessonId: string): { all: string[]; fresh: readonly string[] } {
  const all: string[] = [];
  for (const lesson of lessonsFor(layoutId)) {
    all.push(...lesson.newCodes);
    if (lesson.id === lessonId) return { all, fresh: lesson.newCodes };
  }
  return { all, fresh: [] };
}

function pseudoWord(letters: string[], fresh: string[], random: () => number): string {
  const length = 2 + Math.floor(random() * 4); // 2–5
  let w = "";
  for (let i = 0; i < length; i++) {
    const pool = fresh.length && random() < 0.4 ? fresh : letters;
    w += pool[Math.floor(random() * pool.length)];
  }
  return w;
}

/** Repeats each new key, then mixes real words (when enough exist) and pseudo-words. */
function keysDrill(layoutId: LayoutId, language: Locale, lessonId: string, random: () => number): string {
  const { all, fresh } = cumulativeCodes(layoutId, lessonId);
  const letters = lettersOf(layoutId, all);
  const freshLetters = lettersOf(layoutId, fresh);
  const allowed = new Set(letters);

  const warmup = freshLetters.map((l) => `${l}${l}${l} ${l}${l}`).join(" ");
  const pairs = freshLetters.length >= 2 ? `${freshLetters[0]}${freshLetters[1]} ${freshLetters[1]}${freshLetters[0]}` : "";

  const real = COMMON_WORDS[language].filter((w) => [...w].every((ch) => allowed.has(ch)));
  const realWithFresh = real.filter((w) => [...w].some((ch) => freshLetters.includes(ch)));
  const tokens: string[] = [];
  const target = 28;
  while (tokens.length < target) {
    const useReal = real.length >= 12 && random() < 0.6;
    if (useReal) {
      const pool = realWithFresh.length >= 4 && random() < 0.6 ? realWithFresh : real;
      tokens.push(pool[Math.floor(random() * pool.length)]);
    } else {
      tokens.push(pseudoWord(letters, freshLetters, random));
    }
  }
  return [warmup, pairs, tokens.join(" ")].filter(Boolean).join(" ");
}

function specialDrill(layoutId: LayoutId, language: Locale, random: () => number): string {
  const special = lettersOf(layoutId, getLesson(layoutId, "special-letters")?.newCodes ?? []);
  const words = COMMON_WORDS[language].filter((w) => [...w].some((ch) => special.includes(ch)));
  const warmup = special.map((l) => `${l}${l} ${l}`).join(" ");
  const list = words.length >= 5 ? randomWords(words, 24, random) : special.join(" ").repeat(4);
  return `${warmup} ${list}`;
}

function capitalsDrill(language: Locale, random: () => number): string {
  return randomWords(COMMON_WORDS[language], 24, random)
    .split(" ")
    .map((w, i) => (i % 2 === 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function numbersDrill(random: () => number): string {
  const tokens: string[] = [];
  for (let i = 0; i < 24; i++) {
    const digits = 1 + Math.floor(random() * 4);
    let n = "";
    for (let d = 0; d < digits; d++) n += Math.floor(random() * 10);
    tokens.push(n);
  }
  return tokens.join(" ");
}

/** Generated (or selected) text for a lesson. `attempt` varies the drill between retries. */
export function lessonText(layoutId: LayoutId, language: Locale, lessonId: string, attempt = 0): string {
  const lesson = getLesson(layoutId, lessonId);
  if (!lesson) throw new Error(`Unknown lesson ${lessonId}`);
  let seed = attempt * 7919;
  for (const ch of `${layoutId}:${language}:${lessonId}`) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const random = seededRandom(seed);

  switch (lesson.kind) {
    case "keys":
      return keysDrill(layoutId, language, lessonId, random);
    case "special":
      return specialDrill(layoutId, language, random);
    case "capitals":
      return capitalsDrill(language, random);
    case "numbers":
      return numbersDrill(random);
    case "punctuation": {
      const text = getLibraryText(`${language}-business-1`);
      return text?.body ?? "";
    }
    case "sentences": {
      const texts = LIBRARY.filter((t) => t.language === language && t.topic !== "business");
      return texts[Math.floor(random() * texts.length)].body;
    }
  }
}

/** Accuracy required to mark a lesson as passed. */
export const LESSON_PASS_ACCURACY = 90;
