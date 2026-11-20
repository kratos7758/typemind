/**
 * Session statistics — documented conventions (ADR-008).
 *
 *  netWpm      = (correct characters in the final text / 5) / minutes
 *  rawWpm      = (all character keystrokes / 5) / minutes
 *  accuracy    = correct keystrokes / all character keystrokes × 100
 *                (an error fixed with Backspace still counts as an error)
 *  uncorrected = positions still wrong at the end
 *  corrected   = positions that had at least one error and ended correct
 *  consistency = 100 × (1 − coefficient of variation of inter-keystroke intervals), clamped to [0, 100]
 *
 * "Minutes" = active typing time (pauses excluded), from the FIRST keystroke to the
 * last one (or the time limit) — the same convention as most typing tools.
 * Deletions are not keystrokes here.
 * Intervals longer than IDLE_GAP_MS are treated as hesitations and excluded from
 * latency and consistency, so a short distraction doesn't distort key statistics.
 */
import type { EngineResult, Keystroke } from "./engine";
import { isWhitespace, typedForm } from "./text";

export const IDLE_GAP_MS = 2000;
const MIN_INTERVALS_FOR_CONSISTENCY = 10;

export type KeyStat = { attempts: number; errors: number; totalLatencyMs: number; latencySamples: number };
export type TimelinePoint = { t: number; wpm: number; raw: number; errors: number };

export type SessionSummary = {
  durationMs: number;
  netWpm: number;
  rawWpm: number;
  accuracy: number;
  keystrokes: number;
  correctKeystrokes: number;
  /** Correct characters in the final text (basis of net WPM). */
  correctChars: number;
  correctedErrors: number;
  uncorrectedErrors: number;
  consistency: number | null;
  completed: boolean;
  /** Keyed by the character to press (typographic variants folded, e.g. ’ → '). */
  keys: Record<string, KeyStat>;
  /** Letter pairs only (no whitespace), keyed by typed form, lower-cased. */
  bigrams: Record<string, KeyStat>;
  /** One point per second of active typing. */
  timeline: TimelinePoint[];
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const wpm = (chars: number, ms: number) => (ms <= 0 ? 0 : chars / 5 / (ms / 60_000));

export function summarize(result: EngineResult): SessionSummary {
  const { states, keystrokes, elapsedMs, chars } = result;

  const correctChars = states.filter((s) => s === "correct" || s === "corrected").length;
  const corrected = states.filter((s) => s === "corrected").length;
  const uncorrected = states.filter((s) => s === "incorrect").length;
  const correctKeystrokes = keystrokes.filter((k) => k.correct).length;

  return {
    durationMs: Math.round(elapsedMs),
    netWpm: round1(wpm(correctChars, elapsedMs)),
    rawWpm: round1(wpm(keystrokes.length, elapsedMs)),
    accuracy: keystrokes.length ? round1((correctKeystrokes / keystrokes.length) * 100) : 0,
    keystrokes: keystrokes.length,
    correctKeystrokes,
    correctChars,
    correctedErrors: corrected,
    uncorrectedErrors: uncorrected,
    consistency: consistency(keystrokes),
    completed: result.completed,
    keys: keyStats(keystrokes),
    bigrams: bigramStats(keystrokes, chars),
    timeline: timeline(keystrokes, elapsedMs),
  };
}

/** Interval before each keystroke, or null for the first one / after an idle gap. */
function intervals(keystrokes: readonly Keystroke[]): (number | null)[] {
  return keystrokes.map((k, i) => {
    if (i === 0) return null;
    const gap = k.t - keystrokes[i - 1].t;
    return gap > IDLE_GAP_MS ? null : gap;
  });
}

export function consistency(keystrokes: readonly Keystroke[]): number | null {
  const gaps = intervals(keystrokes).filter((g): g is number => g !== null);
  if (gaps.length < MIN_INTERVALS_FOR_CONSISTENCY) return null;
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  if (mean === 0) return null;
  const variance = gaps.reduce((a, g) => a + (g - mean) ** 2, 0) / gaps.length;
  const cv = Math.sqrt(variance) / mean;
  return round1(Math.min(100, Math.max(0, 100 * (1 - cv))));
}

const emptyStat = (): KeyStat => ({ attempts: 0, errors: 0, totalLatencyMs: 0, latencySamples: 0 });

/** Only first attempts at a position count: retries after an error are corrections, not new attempts. */
function keyStats(keystrokes: readonly Keystroke[]): Record<string, KeyStat> {
  const gaps = intervals(keystrokes);
  const out: Record<string, KeyStat> = {};
  keystrokes.forEach((k, i) => {
    if (!k.firstAttempt) return;
    const key = typedForm(k.expected);
    const stat = (out[key] ??= emptyStat());
    stat.attempts++;
    if (!k.correct) stat.errors++;
    const gap = gaps[i];
    if (gap !== null) {
      stat.totalLatencyMs += gap;
      stat.latencySamples++;
    }
  });
  return out;
}

function bigramStats(keystrokes: readonly Keystroke[], chars: readonly string[]): Record<string, KeyStat> {
  const gaps = intervals(keystrokes);
  const out: Record<string, KeyStat> = {};
  keystrokes.forEach((k, i) => {
    if (!k.firstAttempt || k.index === 0) return;
    const prev = chars[k.index - 1];
    if (isWhitespace(prev) || isWhitespace(k.expected)) return;
    const bigram = (typedForm(prev) + typedForm(k.expected)).toLowerCase();
    const stat = (out[bigram] ??= emptyStat());
    stat.attempts++;
    if (!k.correct) stat.errors++;
    const gap = gaps[i];
    if (gap !== null) {
      stat.totalLatencyMs += gap;
      stat.latencySamples++;
    }
  });
  return out;
}

function timeline(keystrokes: readonly Keystroke[], elapsedMs: number): TimelinePoint[] {
  const seconds = Math.ceil(elapsedMs / 1000);
  const points: TimelinePoint[] = [];
  let cursor = 0;
  let cumulativeCorrect = 0;
  for (let s = 1; s <= seconds; s++) {
    const end = Math.min(s * 1000, elapsedMs);
    let inSecond = 0;
    let errors = 0;
    while (cursor < keystrokes.length && keystrokes[cursor].t <= end) {
      const k = keystrokes[cursor++];
      inSecond++;
      if (k.correct) cumulativeCorrect++;
      else errors++;
    }
    const secondLength = end - (s - 1) * 1000;
    points.push({
      t: s,
      wpm: round1(wpm(cumulativeCorrect, end)),
      raw: round1(wpm(inSecond, secondLength)),
      errors,
    });
  }
  return points;
}
