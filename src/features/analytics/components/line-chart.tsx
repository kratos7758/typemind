"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatNumber, formatPercent } from "@/lib/format";

/**
 * Single-series line chart (dataviz skill: 2px line, ~10% area wash, ringed end dot,
 * end-value label only, hairline grid, crosshair + tooltip on hover AND keyboard,
 * table view). One series → no legend: the title names it.
 */
type Point = { date: string; value: number };

type Props = {
  title: string;
  points: Point[];
  unit: "wpm" | "percent";
  locale: string;
  /** Lower bound of the y axis (0 for speed; accuracy charts zoom in). */
  yMin?: number;
  yMax?: number;
  tableLabels: { show: string; date: string; value: string };
};

const HEIGHT = 200;
const PAD = { top: 16, right: 56, bottom: 26, left: 40 };

function niceStep(range: number, ticks: number) {
  const raw = range / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000;

export function LineChart({ title, points, unit, locale, yMin, yMax, tableLabels }: Props) {
  const wrapper = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fmt = (v: number) => (unit === "percent" ? formatPercent(locale, v) : formatNumber(locale, v));
  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }),
    [locale],
  );
  const fmtDate = (d: string) => dateFmt.format(new Date(`${d}T00:00:00Z`));

  const geometry = useMemo(() => {
    const values = points.map((p) => p.value);
    const loRaw = yMin ?? Math.max(0, Math.min(...values) - 5);
    const hiRaw = yMax ?? Math.max(...values, loRaw + 1);
    const step = niceStep(hiRaw - loRaw, 4);
    // Ticks on clean multiples of the step (e.g. 90 / 95 / 100, never 91 / 96).
    const lo = yMin ?? Math.floor(loRaw / step) * step;
    const hi = yMax ?? Math.ceil(hiRaw / step) * step;
    const ticks: number[] = [];
    for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);

    const days = points.map((p) => dayNumber(p.date));
    const d0 = Math.min(...days);
    const d1 = Math.max(...days);
    const innerW = width - PAD.left - PAD.right;
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    const x = (d: number) => PAD.left + (d1 === d0 ? innerW / 2 : ((d - d0) / (d1 - d0)) * innerW);
    const y = (v: number) => PAD.top + innerH - ((v - lo) / (hi - lo || 1)) * innerH;
    const xy = points.map((p, i) => ({ x: x(days[i]), y: y(p.value) }));
    const line = xy.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("");
    const baseline = PAD.top + innerH;
    const area = xy.length > 1 ? `${line}L${xy[xy.length - 1].x},${baseline}L${xy[0].x},${baseline}Z` : "";
    return { ticks, y, xy, line, area, baseline };
  }, [points, width, yMin, yMax]);

  if (!points.length) return null;
  const { ticks, y, xy, line, area, baseline } = geometry;
  const last = xy.length - 1;

  const nearest = (clientX: number) => {
    const rect = wrapper.current?.getBoundingClientRect();
    if (!rect) return null;
    const px = clientX - rect.left;
    let best = 0;
    xy.forEach((p, i) => {
      if (Math.abs(p.x - px) < Math.abs(xy[best].x - px)) best = i;
    });
    return best;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") setActive((i) => Math.min(last, (i ?? -1) + 1));
    else if (e.key === "ArrowLeft") setActive((i) => Math.max(0, (i ?? last + 1) - 1));
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  };

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="text-sm font-medium">{title}</figcaption>
      <div ref={wrapper} className="relative">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`${title}. ${points.map((p) => `${fmtDate(p.date)} : ${fmt(p.value)}`).join(" ; ")}`}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
          onPointerMove={(e) => setActive(nearest(e.clientX))}
          onPointerLeave={() => setActive(null)}
          className="block touch-pan-y rounded-md focus-visible:outline-none"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-fg-muted text-[11px] tabular-nums">
                {unit === "percent" ? formatPercent(locale, t, 0) : formatNumber(locale, t, 0)}
              </text>
            </g>
          ))}
          <text x={xy[0].x} y={HEIGHT - 6} textAnchor={xy.length > 1 ? "start" : "middle"} className="fill-fg-muted text-[11px]">
            {fmtDate(points[0].date)}
          </text>
          {xy.length > 1 ? (
            <text x={xy[last].x} y={HEIGHT - 6} textAnchor="end" className="fill-fg-muted text-[11px]">
              {fmtDate(points[last].date)}
            </text>
          ) : null}

          {area ? <path d={area} fill="var(--chart-area)" /> : null}
          <path d={line} fill="none" stroke="var(--chart-line)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {active !== null ? (
            <>
              <line x1={xy[active].x} x2={xy[active].x} y1={PAD.top} y2={baseline} stroke="var(--fg-subtle)" strokeWidth={1} />
              <circle cx={xy[active].x} cy={xy[active].y} r={4} fill="var(--chart-line)" stroke="var(--bg)" strokeWidth={2} />
            </>
          ) : null}

          {/* End marker + the one direct label: the latest value. */}
          <circle cx={xy[last].x} cy={xy[last].y} r={4} fill="var(--chart-line)" stroke="var(--bg)" strokeWidth={2} />
          <text x={xy[last].x + 8} y={xy[last].y} dy="0.32em" className="fill-fg text-[12px] font-semibold tabular-nums">
            {fmt(points[last].value)}
          </text>
        </svg>

        {active !== null ? (
          <div
            role="status"
            className="pointer-events-none absolute top-0 rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-sm"
            style={{ left: Math.min(Math.max(0, xy[active].x - 60), width - 130) }}
          >
            <span className="block text-sm font-semibold tabular-nums text-fg">{fmt(points[active].value)}</span>
            <span className="flex items-center gap-1.5 text-fg-muted">
              <span aria-hidden className="inline-block h-0.5 w-3 rounded bg-[var(--chart-line)]" />
              {fmtDate(points[active].date)}
            </span>
          </div>
        ) : null}
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-fg-muted hover:text-fg">{tableLabels.show}</summary>
        <table className="mt-2 w-full max-w-sm text-left">
          <thead>
            <tr className="text-fg-muted">
              <th className="py-1 font-normal">{tableLabels.date}</th>
              <th className="py-1 text-right font-normal">{tableLabels.value}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {points.map((p) => (
              <tr key={p.date} className="border-t border-border">
                <td className="py-1">{fmtDate(p.date)}</td>
                <td className="py-1 text-right">{fmt(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
