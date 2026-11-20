"use client";

import type { ReactNode } from "react";
import type { SessionSummary } from "../stats";
import { formatNumber, formatPercent } from "@/lib/format";

export type ResultsLabels = {
  title: string;
  netWpm: string;
  accuracy: string;
  rawWpm: string;
  duration: string;
  corrected: string;
  uncorrected: string;
  consistency: string;
  notEnoughData: string;
  weakKeys: string;
  noWeakKeys: string;
  explainNet: string;
};

const fmtDuration = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s` : `${s} s`;
};

/** Keys with at least one error in this session, worst error rate first. */
export function sessionWeakKeys(summary: SessionSummary, limit = 5) {
  return Object.entries(summary.keys)
    .filter(([, s]) => s.errors > 0)
    .map(([key, s]) => ({ key, errors: s.errors, attempts: s.attempts, rate: s.errors / s.attempts }))
    .sort((a, b) => b.rate - a.rate || b.errors - a.errors)
    .slice(0, limit);
}

function Metric({ label, value, emphasis }: { label: string; value: ReactNode; emphasis?: boolean }) {
  return (
    <div>
      <dt className="text-sm text-fg-muted">{label}</dt>
      <dd className={emphasis ? "font-mono text-4xl font-semibold tabular-nums" : "font-mono text-xl tabular-nums"}>
        {value}
      </dd>
    </div>
  );
}

export function SessionResults({
  summary,
  labels,
  locale,
  actions,
  status,
}: {
  summary: SessionSummary;
  labels: ResultsLabels;
  locale: string;
  actions: ReactNode;
  status?: ReactNode;
}) {
  const weak = sessionWeakKeys(summary);
  const keyName = (k: string) => (k === " " ? "␣" : k === "\n" ? "↵" : k);

  return (
    <section className="flex flex-col gap-8" aria-live="polite">
      <h2 className="text-xl font-semibold">{labels.title}</h2>
      <dl className="flex flex-wrap gap-x-12 gap-y-6">
        <Metric label={labels.netWpm} value={formatNumber(locale, summary.netWpm)} emphasis />
        <Metric label={labels.accuracy} value={formatPercent(locale, summary.accuracy)} emphasis />
      </dl>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-5">
        <Metric label={labels.rawWpm} value={formatNumber(locale, summary.rawWpm)} />
        <Metric label={labels.duration} value={fmtDuration(summary.durationMs)} />
        <Metric label={labels.corrected} value={summary.correctedErrors} />
        <Metric label={labels.uncorrected} value={summary.uncorrectedErrors} />
        <Metric label={labels.consistency} value={summary.consistency === null ? "—" : formatPercent(locale, summary.consistency, 0)} />
      </dl>
      <p className="max-w-2xl text-sm text-fg-muted">{labels.explainNet}</p>

      <div>
        <h3 className="text-sm font-medium">{labels.weakKeys}</h3>
        {weak.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {weak.map((w) => (
              <li key={w.key} className="rounded-md border border-border px-3 py-2 font-mono text-sm">
                <span className="text-base font-semibold">{keyName(w.key)}</span>{" "}
                <span className="text-fg-muted">
                  {w.errors}/{w.attempts}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-fg-muted">
            {summary.keystrokes < 20 ? labels.notEnoughData : labels.noWeakKeys}
          </p>
        )}
      </div>

      {status}
      <div className="flex flex-wrap gap-3">{actions}</div>
    </section>
  );
}
