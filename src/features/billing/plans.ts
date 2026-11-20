/**
 * Plan ↔ Stripe mapping and subscription status rules (pure, unit-tested).
 *
 * Prices are found in Stripe by LOOKUP KEY ("typemind_pro_monthly"), so no price id
 * has to be copied into the code or the environment: `npm run stripe:setup` creates them.
 */
import type Stripe from "stripe";

export const PAID_PLANS = ["pro_monthly", "pro_yearly"] as const;
export type PaidPlanId = (typeof PAID_PLANS)[number];
export type PlanId = "free" | PaidPlanId;

export const isPaidPlan = (v: unknown): v is PaidPlanId => typeof v === "string" && (PAID_PLANS as readonly string[]).includes(v);

const LOOKUP_PREFIX = "typemind_";
export const lookupKey = (plan: PaidPlanId) => `${LOOKUP_PREFIX}${plan}`;

export function planFromLookupKey(key: string | null | undefined): PaidPlanId | null {
  if (!key?.startsWith(LOOKUP_PREFIX)) return null;
  const plan = key.slice(LOOKUP_PREFIX.length);
  return isPaidPlan(plan) ? plan : null;
}

export type OurStatus = "active" | "trialing" | "past_due" | "canceled" | "incomplete" | "unpaid" | "paused";

const KNOWN: ReadonlySet<string> = new Set(["active", "trialing", "past_due", "canceled", "incomplete", "unpaid", "paused"]);

/** Unknown statuses (added by Stripe later) map to "unpaid": no access until we handle them. */
export function mapStatus(status: Stripe.Subscription.Status): OurStatus {
  if (status === "incomplete_expired") return "canceled";
  return KNOWN.has(status) ? (status as OurStatus) : "unpaid";
}

/**
 * Statuses that grant the paid plan. `past_due` keeps access while Stripe retries the
 * payment (smart retries); Stripe then moves the subscription to `unpaid`/`canceled`.
 */
export const ACCESS_STATUSES: ReadonlySet<OurStatus> = new Set(["active", "trialing", "past_due"]);

/** Monthly-equivalent revenue in cents (for MRR). */
export function monthlyCents(priceCents: number, interval: "month" | "year" | null): number {
  if (!interval) return 0;
  return interval === "year" ? Math.round(priceCents / 12) : priceCents;
}

/** Display name of a plan in the UI language (database names are internal). */
export function planLabel(
  planId: string,
  t: { free: string; pro: string; monthly: string; yearly: string },
): string {
  if (planId === "pro_monthly") return `${t.pro} (${t.monthly})`;
  if (planId === "pro_yearly") return `${t.pro} (${t.yearly})`;
  return t.free;
}
