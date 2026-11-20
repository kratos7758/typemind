/**
 * Adaptive drill: a sequence of real words chosen to exercise the user's weak keys
 * and letter pairs, mixed with ordinary words so the rhythm stays natural.
 * Pure and seeded (same inputs → same text).
 */
import type { Locale } from "@/i18n/config";
import { LIBRARY } from "@/content/library";
import { COMMON_WORDS, seededRandom } from "@/content/words";

export const ADAPTIVE_CONFIG = {
  words: 45,
  /** Share of words that must contain at least one target. */
  targetShare: 0.65,
  minTargets: 1,
} as const;

/** Vocabulary: common words + words from the library texts of the language (lower-case, letters only). */
const vocabularyCache = new Map<Locale, string[]>();
export function vocabulary(language: Locale): string[] {
  const cached = vocabularyCache.get(language);
  if (cached) return cached;
  const fromTexts = LIBRARY.filter((t) => t.language === language)
    .flatMap((t) => t.body.toLowerCase().split(/[^\p{L}]+/u))
    .filter((w) => w.length >= 2);
  const words = [...new Set([...COMMON_WORDS[language], ...fromTexts])];
  vocabularyCache.set(language, words);
  return words;
}

/** How many target keys/bigrams a word exercises. */
export function targetScore(word: string, keys: readonly string[], bigrams: readonly string[]): number {
  let score = 0;
  for (const k of keys) if (word.includes(k)) score += 1;
  for (const b of bigrams) if (word.includes(b)) score += 2; // a pair is harder to find: weigh it more
  return score;
}

export type AdaptiveTargets = { keys: readonly string[]; bigrams: readonly string[] };

export function hasTargets(t: AdaptiveTargets) {
  return t.keys.length + t.bigrams.length >= ADAPTIVE_CONFIG.minTargets;
}

export function adaptiveText(language: Locale, targets: AdaptiveTargets, seed: number): string {
  const random = seededRandom(seed);
  const keys = targets.keys.map((k) => k.toLowerCase());
  const bigrams = targets.bigrams.map((b) => b.toLowerCase());
  const words = vocabulary(language);

  const scored = words.map((w) => ({ w, s: targetScore(w, keys, bigrams) }));
  const targeted = scored.filter((x) => x.s > 0);
  const plain = scored.filter((x) => x.s === 0).map((x) => x.w);
  if (!targeted.length) return "";

  // Weighted pick: higher-scoring words come up more often.
  const totalWeight = targeted.reduce((a, x) => a + x.s, 0);
  const pickTargeted = () => {
    let r = random() * totalWeight;
    for (const x of targeted) {
      r -= x.s;
      if (r <= 0) return x.w;
    }
    return targeted[targeted.length - 1].w;
  };

  const out: string[] = [];
  while (out.length < ADAPTIVE_CONFIG.words) {
    const useTarget = plain.length === 0 || random() < ADAPTIVE_CONFIG.targetShare;
    const word = useTarget ? pickTargeted() : plain[Math.floor(random() * plain.length)];
    if (word !== out[out.length - 1]) out.push(word);
  }
  return out.join(" ");
}
