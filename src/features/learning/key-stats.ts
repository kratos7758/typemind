/**
 * Merging per-key (and per-bigram) session stats into long-term aggregates.
 *
 * The session's weight grows with the evidence it brings:
 *   alphaEff = 1 − (1 − α)^(min(attempts, 30) / 10)
 * → 10 attempts weigh like one "standard" EWMA step (α), 1 attempt barely moves
 *   the average, 30+ attempts weigh like three steps.
 */
import { LEARNING_CONFIG } from "./profile";
import type { KeyStat } from "@/features/typing-engine/stats";

export type StoredKeyStat = {
  attempts: number;
  errors: number;
  ewmaErrorRate: number | null;
  ewmaLatencyMs: number | null;
};

export const effectiveAlpha = (attempts: number, alpha: number = LEARNING_CONFIG.ewmaAlpha) =>
  1 - Math.pow(1 - alpha, Math.min(attempts, 30) / 10);

const blend = (previous: number | null, value: number | null, a: number) =>
  value === null ? previous : previous === null ? value : a * value + (1 - a) * previous;

export function mergeKeyStat(existing: StoredKeyStat | undefined, session: KeyStat): StoredKeyStat {
  const a = effectiveAlpha(session.attempts);
  const rate = session.attempts > 0 ? session.errors / session.attempts : null;
  const latency = session.latencySamples > 0 ? session.totalLatencyMs / session.latencySamples : null;
  const round = (n: number | null, digits: number) => (n === null ? null : Number(n.toFixed(digits)));
  return {
    attempts: (existing?.attempts ?? 0) + session.attempts,
    errors: (existing?.errors ?? 0) + session.errors,
    ewmaErrorRate: round(blend(existing?.ewmaErrorRate ?? null, rate, a), 4),
    ewmaLatencyMs: round(blend(existing?.ewmaLatencyMs ?? null, latency, a), 1),
  };
}

/** Server-side recomputation of headline numbers from raw counts. */
export function headline(summary: { durationMs: number; keystrokes: number; correctKeystrokes: number; correctChars: number }) {
  const minutes = summary.durationMs / 60_000;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return {
    netWpm: r1(summary.correctChars / 5 / minutes),
    rawWpm: r1(summary.keystrokes / 5 / minutes),
    accuracy: r1((summary.correctKeystrokes / summary.keystrokes) * 100),
  };
}
