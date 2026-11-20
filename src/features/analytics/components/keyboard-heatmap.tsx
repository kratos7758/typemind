"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatNumber, formatPercent } from "@/lib/format";
import { keyLabel, LAYOUTS, ROWS, type LayoutId } from "@/features/typing-engine/layouts";

/**
 * Keyboard heatmap: ordinal single-hue ramp (validated light & dark), one cell per
 * physical key. Keys without enough attempts are neutral and say so on hover/focus.
 * Hover and keyboard focus share one readout; a table view lists every value.
 */
export type HeatCell = { code: string; label: string; attempts: number; errorRate: number; bucket: number | null };

type Labels = {
  legendLow: string;
  legendHigh: string;
  notEnough: string;
  readout: string; // "{key} : {rate} d'erreurs · {attempts} essais"
  table: { show: string; key: string; rate: string; attempts: string };
};

const HEAT_VARS = ["var(--heat-0)", "var(--heat-1)", "var(--heat-2)", "var(--heat-3)"];
/** Label ink inside a filled cell, by fill luminance — per theme (see --heat-ink-* in globals.css). */
const INK = ["var(--heat-ink-0)", "var(--heat-ink-1)", "var(--heat-ink-2)", "var(--heat-ink-3)"];

export function KeyboardHeatmap({
  layout,
  cells,
  locale,
  labels,
}: {
  layout: LayoutId;
  cells: HeatCell[];
  locale: string;
  labels: Labels;
}) {
  const byCode = new Map(cells.map((c) => [c.code, c]));
  const [active, setActive] = useState<string | null>(null);
  const { form } = LAYOUTS[layout];
  const rows = [
    ROWS.E,
    ROWS.D,
    [...ROWS.C, ...(form === "iso" ? ["Backslash"] : [])],
    [...(form === "iso" ? ["IntlBackslash"] : []), ...ROWS.B],
  ];
  const indent = ["0", "4%", "6%", form === "iso" ? "2%" : "8%"];

  const describe = (code: string) => {
    const cell = byCode.get(code);
    const key = keyLabel(layout, code, 0) ?? code;
    if (!cell || cell.bucket === null) return `${key} — ${labels.notEnough}`;
    return labels.readout
      .replace("{key}", key)
      .replace("{rate}", formatPercent(locale, cell.errorRate * 100))
      .replace("{attempts}", formatNumber(locale, cell.attempts, 0));
  };

  const ranked = cells.filter((c) => c.bucket !== null).sort((a, b) => b.errorRate - a.errorRate);

  return (
    <div className="flex flex-col gap-3">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-1" onPointerLeave={() => setActive(null)}>
        {rows.map((row, r) => (
          <div key={r} className="flex gap-1" style={{ paddingLeft: indent[r] }}>
            {row.map((code) => {
              const cell = byCode.get(code);
              const bucket = cell?.bucket ?? null;
              const label = keyLabel(layout, code, 0) ?? "";
              return (
                <button
                  key={code}
                  type="button"
                  aria-label={describe(code)}
                  onPointerEnter={() => setActive(code)}
                  onFocus={() => setActive(code)}
                  onBlur={() => setActive(null)}
                  style={bucket === null ? { background: "var(--heat-none)" } : { background: HEAT_VARS[bucket], color: INK[bucket] }}
                  className={cn(
                    "flex h-9 min-w-0 flex-1 items-center justify-center rounded-[6px] font-mono text-[13px] transition-[filter] sm:h-10",
                    bucket === null && "text-fg-subtle",
                    active === code && "ring-2 ring-fg ring-offset-2 ring-offset-bg",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <p className="min-h-5 text-center text-sm text-fg" aria-live="polite">
        {active ? describe(active) : ""}
      </p>

      <div className="flex items-center justify-center gap-2 text-xs text-fg-muted">
        <span>{labels.legendLow}</span>
        {HEAT_VARS.map((v) => (
          <span key={v} aria-hidden className="h-3 w-6 rounded-[3px]" style={{ background: v }} />
        ))}
        <span>{labels.legendHigh}</span>
      </div>

      {ranked.length ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-fg-muted hover:text-fg">{labels.table.show}</summary>
          <table className="mt-2 w-full max-w-sm text-left">
            <thead>
              <tr className="text-fg-muted">
                <th className="py-1 font-normal">{labels.table.key}</th>
                <th className="py-1 text-right font-normal">{labels.table.rate}</th>
                <th className="py-1 text-right font-normal">{labels.table.attempts}</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {ranked.map((c) => (
                <tr key={c.code} className="border-t border-border">
                  <td className="py-1 font-mono">{c.label}</td>
                  <td className="py-1 text-right">{formatPercent(locale, c.errorRate * 100)}</td>
                  <td className="py-1 text-right">{formatNumber(locale, c.attempts, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : null}
    </div>
  );
}
