/**
 * Analytics computations — pure functions over rows already read from the database.
 */
import { localDate, LEARNING_CONFIG } from "@/features/learning/profile";
import type { SessionMode } from "@/features/sessions/schema";
import { strokesFor, type LayoutId } from "@/features/typing-engine/layouts";

export type SessionRow = {
  mode: SessionMode;
  status: "completed" | "abandoned";
  endedAt: Date;
  durationMs: number;
  netWpm: number | null;
  accuracy: number | null;
  keystrokes: number | null;
};

export type DailyPoint = { date: string; wpm: number; accuracy: number; sessions: number };

const isRepresentative = (r: SessionRow) =>
  LEARNING_CONFIG.profileModes.includes(r.mode) &&
  r.netWpm !== null &&
  r.accuracy !== null &&
  (r.keystrokes ?? 0) >= LEARNING_CONFIG.minKeystrokesForProfile;

/**
 * One point per local day: keystroke-weighted mean of net WPM and accuracy,
 * over representative sessions only (lessons and very short sessions excluded,
 * consistent with the learning profile).
 */
export function dailySeries(rows: readonly SessionRow[], timeZone?: string): DailyPoint[] {
  const byDay = new Map<string, { w: number; wpm: number; acc: number; n: number }>();
  for (const r of rows) {
    if (!isRepresentative(r)) continue;
    const day = localDate(r.endedAt, timeZone);
    const weight = r.keystrokes!;
    const agg = byDay.get(day) ?? { w: 0, wpm: 0, acc: 0, n: 0 };
    agg.w += weight;
    agg.wpm += r.netWpm! * weight;
    agg.acc += r.accuracy! * weight;
    agg.n += 1;
    byDay.set(day, agg);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, a]) => ({
      date,
      wpm: Math.round((a.wpm / a.w) * 10) / 10,
      accuracy: Math.round((a.acc / a.w) * 10) / 10,
      sessions: a.n,
    }));
}

export type Records = {
  bestSpeedTestWpm: number | null;
  bestTextAccuracy: number | null;
  totalPracticeMs: number;
  sessions: number;
  practiceDays: number;
};

export function records(rows: readonly SessionRow[], timeZone?: string): Records {
  const speed = rows.filter((r) => r.mode === "speed_test" && r.status === "completed" && r.netWpm !== null);
  const texts = rows.filter(
    (r) => (r.mode === "adaptive" || r.mode === "ai_text" || r.mode === "accuracy") && r.status === "completed" && r.accuracy !== null,
  );
  return {
    bestSpeedTestWpm: speed.length ? Math.max(...speed.map((r) => r.netWpm!)) : null,
    bestTextAccuracy: texts.length ? Math.max(...texts.map((r) => r.accuracy!)) : null,
    totalPracticeMs: rows.reduce((a, r) => a + r.durationMs, 0),
    sessions: rows.length,
    practiceDays: new Set(rows.map((r) => localDate(r.endedAt, timeZone))).size,
  };
}

export type KeyStatRow = { char: string; attempts: number; errors: number; ewmaErrorRate: number | null; ewmaLatencyMs: number | null };
export type KeyHeat = { code: string; chars: string[]; attempts: number; errorRate: number };

/** Minimum evidence before a key is colored on the heatmap. */
export const HEATMAP_MIN_ATTEMPTS = 15;

/**
 * Per physical key (a and A share a key): attempts summed, smoothed error rate
 * averaged with attempts as weights. Characters without a direct key are skipped.
 */
export function keyHeat(layoutId: LayoutId, rows: readonly KeyStatRow[]): Map<string, KeyHeat> {
  const out = new Map<string, KeyHeat & { weighted: number }>();
  for (const r of rows) {
    const strokes = strokesFor(layoutId, r.char);
    if (!strokes || strokes.length !== 1 || r.ewmaErrorRate === null) continue;
    const code = strokes[0].code;
    const cur = out.get(code) ?? { code, chars: [], attempts: 0, errorRate: 0, weighted: 0 };
    cur.chars.push(r.char);
    cur.attempts += r.attempts;
    cur.weighted += r.ewmaErrorRate * r.attempts;
    cur.errorRate = cur.attempts ? cur.weighted / cur.attempts : 0;
    out.set(code, cur);
  }
  return new Map(
    [...out].map(([k, v]) => [k, { code: v.code, chars: v.chars, attempts: v.attempts, errorRate: v.errorRate }]),
  );
}

/** Discrete buckets for the ordinal heat ramp (0 = lowest). Thresholds on the error rate. */
export const HEAT_THRESHOLDS = [0.03, 0.06, 0.1] as const;
export const heatBucket = (rate: number) => HEAT_THRESHOLDS.filter((t) => rate >= t).length;

export function slowestKeys(rows: readonly KeyStatRow[], limit = 6) {
  return rows
    .filter((r) => /^\p{L}$/u.test(r.char) && r.attempts >= HEATMAP_MIN_ATTEMPTS && r.ewmaLatencyMs !== null)
    .sort((a, b) => b.ewmaLatencyMs! - a.ewmaLatencyMs!)
    .slice(0, limit);
}
