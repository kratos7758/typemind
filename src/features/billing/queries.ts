import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { adminDb } from "@/lib/db/client";
import { subscriptionPlans, subscriptions } from "@/lib/db/schema";
import { getStripe } from "@/lib/stripe/client";

export type PublicPlan = { id: string; name: string; priceCents: number; currency: string; interval: "month" | "year" | null };

/** Public plan catalogue (prices come from the database, never hardcoded). Cached: prices change rarely. */
export async function getPublicPlans(): Promise<PublicPlan[]> {
  "use cache";
  cacheTag("plans");
  cacheLife("hours");
  return adminDb()
    .select({
      id: subscriptionPlans.id,
      name: subscriptionPlans.name,
      priceCents: subscriptionPlans.priceCents,
      currency: subscriptionPlans.currency,
      interval: subscriptionPlans.interval,
    })
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.isActive, true))
    .orderBy(asc(subscriptionPlans.priceCents));
}

export async function getSubscription(userId: string) {
  const [row] = await adminDb().select().from(subscriptions).where(eq(subscriptions.userId, userId));
  return row ?? null;
}

export const billingConfigured = () => getStripe() !== null;

export function formatPrice(locale: string, cents: number, currency: string) {
  return new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: currency.toUpperCase() }).format(
    cents / 100,
  );
}
