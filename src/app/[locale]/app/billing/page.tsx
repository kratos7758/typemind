import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { requireOnboardedUser } from "@/features/account/guards";
import { getEntitlements } from "@/features/billing/entitlements";
import { getQuota } from "@/features/billing/quota";
import { billingConfigured, formatPrice, getPublicPlans, getSubscription } from "@/features/billing/queries";
import { ACCESS_STATUSES, isPaidPlan, planLabel, type OurStatus } from "@/features/billing/plans";
import { BillingActions } from "@/features/billing/components/billing-actions";
import { Alert } from "@/components/ui/field";
import { format } from "@/lib/utils";

export default async function BillingPage({ searchParams }: PageProps<"/[locale]/app/billing">) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">{dict.billing.title}</h1>
      <Suspense fallback={<p className="text-fg-muted">{dict.common.loading}</p>}>
        <Billing locale={locale} dict={dict} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Billing({
  locale,
  dict,
  searchParams,
}: {
  locale: Locale;
  dict: Dictionary;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = dict.billing;
  const { claims } = await requireOnboardedUser(locale);
  const [sub, entitlements, plans, params] = await Promise.all([
    getSubscription(claims.sub),
    getEntitlements(claims.sub),
    getPublicPlans(),
    searchParams,
  ]);
  const quota = await getQuota(claims.sub, "ai_generation", entitlements.aiGenerationsPerMonth);
  const configured = billingConfigured();

  const p = dict.pricing;
  const planName = planLabel(entitlements.planId, { free: p.free.name, pro: p.pro.name, monthly: p.monthly, yearly: p.yearly });
  const hasPaidPlan = isPaidPlan(sub?.planId) && ACCESS_STATUSES.has(sub!.status as OurStatus);
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
  const priceOf = (id: string) => {
    const p = plans.find((x) => x.id === id);
    return p ? formatPrice(locale, p.priceCents, p.currency) : null;
  };

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      {params.checkout === "success" ? <Alert tone="info">{t.success}</Alert> : null}
      {params.checkout === "canceled" ? <Alert tone="info">{t.canceled}</Alert> : null}

      <section className="flex flex-col gap-2 rounded-md border border-border bg-surface p-6">
        <p className="text-sm text-fg-muted">{t.current}</p>
        <p className="text-2xl font-semibold" data-testid="current-plan">
          {planName}
        </p>
        {hasPaidPlan && sub?.currentPeriodEnd ? (
          <p className="text-sm text-fg-muted">
            {format(sub.cancelAtPeriodEnd ? t.endsOn : t.renews, { date: dateFmt.format(sub.currentPeriodEnd) })}
          </p>
        ) : null}
        {sub?.status === "past_due" ? <Alert>{t.pastDue}</Alert> : null}
        <p className="text-sm text-fg-muted">{format(t.aiUsage, { used: quota.used, limit: quota.limit })}</p>
      </section>

      {configured ? (
        <BillingActions
          locale={locale}
          hasPaidPlan={hasPaidPlan}
          hasCustomer={Boolean(sub?.stripeCustomerId)}
          prices={{ monthly: priceOf("pro_monthly"), yearly: priceOf("pro_yearly") }}
          t={t}
        />
      ) : (
        <Alert tone="info">{t.unavailable}</Alert>
      )}
    </div>
  );
}
