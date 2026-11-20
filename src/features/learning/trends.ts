/**
 * Trend detection: compares the mean of the most recent window with the window before it.
 * Requires two full windows so that one good or bad session cannot flip the trend
 * (distinguishes short-term fluctuation from an actual change).
 */
export type Trend = "improving" | "stable" | "declining" | "unknown";

export const TREND_CONFIG = {
  window: 5,
  /** Minimum change of the window mean to count as a trend. */
  wpmThreshold: 2,
  accuracyThreshold: 1,
} as const;

const mean = (values: readonly number[]) => values.reduce((a, b) => a + b, 0) / values.length;

/** `values` are ordered oldest → newest. */
export function computeTrend(values: readonly number[], threshold: number, window: number = TREND_CONFIG.window): Trend {
  if (values.length < window * 2) return "unknown";
  const recent = values.slice(-window);
  const previous = values.slice(-window * 2, -window);
  const delta = mean(recent) - mean(previous);
  if (delta >= threshold) return "improving";
  if (delta <= -threshold) return "declining";
  return "stable";
}
