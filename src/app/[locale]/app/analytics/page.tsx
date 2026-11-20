import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { requireOnboardedUser } from "@/features/account/guards";
import { getAnalyticsData } from "@/features/account/queries";
import { getEntitlements } from "@/features/billing/entitlements";
import {
  dailySeries,
  heatBucket,
  HEATMAP_MIN_ATTEMPTS,
  keyHeat,
  records,
  slowestKeys,
} from "@/features/analytics/compute";
import { LineChart } from "@/features/analytics/components/line-chart";
import { KeyboardHeatmap, type HeatCell } from "@/features/analytics/components/keyboard-heatmap";
import { keyLabel } from "@/features/typing-engine/layouts";
import { formatNumber, formatPercent } from "@/lib/format";
import { format } from "@/lib/utils";

export default async function AnalyticsPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-2xl font-semibold tracking-tight">{dict.analytics.title}</h1>
      <Suspense fallback={<p className="text-fg-muted">{dict.common.loading}</p>}>
        <Analytics locale={locale} dict={dict} />
      </Suspense>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-fg-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold">{value}</dd>
    </div>
  );
}

const fmtHours = (ms: number, locale: string) => {
  const minutes = Math.round(ms / 60_000);
  return minutes < 60 ? `${minutes} min` : `${formatNumber(locale, minutes / 60, 1)} h`;
};

async function Analytics({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const a = dict.analytics;
  const { claims, user } = await requireOnboardedUser(locale);
  const entitlements = await getEntitlements(claims.sub);
  const data = await getAnalyticsData(claims, user.layoutId, entitlements.historyDays);
  const tz = user.timeZone ?? undefined;

  const series = dailySeries(data.sessions, tz);
  const rec = records(data.sessions, tz);
  const heat = keyHeat(user.layoutId, data.keys);
  const cells: HeatCell[] = [...heat.values()].map((h) => ({
    code: h.code,
    label: keyLabel(user.layoutId, h.code, 0) ?? h.chars[0],
    attempts: h.attempts,
    errorRate: h.errorRate,
    bucket: h.attempts >= HEATMAP_MIN_ATTEMPTS ? heatBucket(h.errorRate) : null,
  }));
  const slow = slowestKeys(data.keys);
  const none = a.none;
  const limited = entitlements.historyDays !== null;

  return (
    <>
      <p className="-mt-6 text-sm text-fg-muted">
        {limited ? format(a.periodLimited, { n: data.days }) : format(a.period, { n: data.days })}
      </p>

      <section className="flex flex-col gap-4">
        <h2 className="font-semibold">{a.records}</h2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-5">
          <Stat label={a.bestSpeed} value={rec.bestSpeedTestWpm !== null ? `${formatNumber(locale, rec.bestSpeedTestWpm)} ${dict.app.wpmShort}` : none} />
          <Stat label={a.bestAccuracy} value={rec.bestTextAccuracy !== null ? formatPercent(locale, rec.bestTextAccuracy) : none} />
          <Stat label={a.totalTime} value={fmtHours(rec.totalPracticeMs, locale)} />
          <Stat label={a.sessions} value={formatNumber(locale, rec.sessions, 0)} />
          <Stat label={a.days} value={formatNumber(locale, rec.practiceDays, 0)} />
        </dl>
      </section>

      {series.length ? (
        <section className="grid gap-10 border-t border-border pt-8 lg:grid-cols-2">
          <LineChart
            title={a.speedChart}
            points={series.map((p) => ({ date: p.date, value: p.wpm }))}
            unit="wpm"
            locale={locale}
            yMin={0}
            tableLabels={{ show: a.showTable, date: a.date, value: a.wpmUnit }}
          />
          <LineChart
            title={a.accuracyChart}
            points={series.map((p) => ({ date: p.date, value: p.accuracy }))}
            unit="percent"
            locale={locale}
            yMax={100}
            tableLabels={{ show: a.showTable, date: a.date, value: a.accuracyUnit }}
          />
          <p className="text-xs text-fg-muted lg:col-span-2">{a.chartNote}</p>
        </section>
      ) : (
        <p className="border-t border-border pt-8 text-fg-muted">{a.empty}</p>
      )}

      <section className="flex flex-col gap-4 border-t border-border pt-8">
        <div>
          <h2 className="font-semibold">{a.heatmap}</h2>
          <p className="text-sm text-fg-muted">{format(a.heatmapHint, { n: HEATMAP_MIN_ATTEMPTS })}</p>
        </div>
        <KeyboardHeatmap
          layout={user.layoutId}
          cells={cells}
          locale={locale}
          labels={{
            legendLow: a.legendLow,
            legendHigh: a.legendHigh,
            notEnough: a.notEnough,
            readout: a.readout,
            table: { show: a.showTable, key: a.key, rate: a.rate, attempts: a.attempts },
          }}
        />
      </section>

      <section className="grid gap-10 border-t border-border pt-8 sm:grid-cols-2">
        <div>
          <h2 className="font-semibold">{a.slowKeys}</h2>
          {slow.length ? (
            <ul className="mt-3 divide-y divide-border">
              {slow.map((k) => (
                <li key={k.char} className="flex items-baseline justify-between py-2 text-sm">
                  <span className="font-mono text-lg">{k.char}</span>
                  <span className="text-fg-muted tabular-nums">
                    {format(a.latency, { ms: formatNumber(locale, k.ewmaLatencyMs!, 0) })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-fg-muted">{dict.app.weakKeysEmpty}</p>
          )}
        </div>
        <div>
          <h2 className="font-semibold">{a.bigrams}</h2>
          {data.bigrams.length ? (
            <ul className="mt-3 divide-y divide-border">
              {data.bigrams.map((b) => (
                <li key={b.bigram} className="flex items-baseline justify-between py-2 text-sm">
                  <span className="font-mono text-lg">{b.bigram}</span>
                  <span className="text-fg-muted tabular-nums">
                    {format(a.errorRate, { rate: formatNumber(locale, (b.ewmaErrorRate ?? 0) * 100, 1) })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-fg-muted">{dict.app.weakKeysEmpty}</p>
          )}
        </div>
      </section>
    </>
  );
}
