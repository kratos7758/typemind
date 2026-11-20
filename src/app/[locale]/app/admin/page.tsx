import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { getAdminMetrics, requireAdmin } from "@/features/admin/metrics";
import { formatPrice } from "@/features/billing/queries";
import { formatNumber } from "@/lib/format";

export default async function AdminPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return (
    <Suspense fallback={<p className="text-fg-muted">{dict.common.loading}</p>}>
      <Admin locale={locale} dict={dict} />
    </Suspense>
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

async function Admin({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  await requireAdmin(locale);
  const m = await getAdminMetrics();
  const t = dict.admin;
  const n = (v: number, d = 0) => formatNumber(locale, v, d);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-sm text-fg-muted">{t.readOnly}</p>
      </div>

      <dl className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
        <Stat label={t.users} value={n(m.users)} />
        <Stat label={t.newUsers} value={n(m.newUsers)} />
        <Stat label={t.onboarded} value={n(m.onboarded)} />
        <Stat label={t.activeUsers} value={n(m.activeUsers)} />
        <Stat label={t.subscriptions} value={n(m.paidSubscriptions)} />
        <Stat label={t.mrr} value={formatPrice(locale, m.mrrCents, "cad")} />
        <Stat label={t.pastDue} value={n(m.pastDue)} />
        <Stat label={t.sessions} value={n(m.sessions)} />
        <Stat label={t.practiceHours} value={n(m.practiceHours, 1)} />
      </dl>

      <section className="border-t border-border pt-6">
        <h2 className="font-semibold">{t.aiTitle}</h2>
        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
          <Stat label={t.aiSucceeded} value={n(m.ai.succeeded)} />
          <Stat label={t.aiFailed} value={n(m.ai.failed)} />
          <Stat label={t.aiInvalid} value={n(m.ai.invalid)} />
          <Stat label={t.aiCost} value={`${n(m.ai.costMicros / 1_000_000, 4)} $ US`} />
        </dl>
      </section>

      <section className="border-t border-border pt-6">
        <h2 className="font-semibold">{t.plans}</h2>
        <table className="mt-3 w-full max-w-sm text-left text-sm">
          <thead>
            <tr className="text-fg-muted">
              <th className="py-1 font-normal">{t.plan}</th>
              <th className="py-1 text-right font-normal">{t.count}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {m.plans.map((p) => (
              <tr key={p.planId} className="border-t border-border">
                <td className="py-1">{p.planId}</td>
                <td className="py-1 text-right">{n(p.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
