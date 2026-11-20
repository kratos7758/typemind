import "server-only";
import { eq } from "drizzle-orm";
import { adminDb } from "@/lib/db/client";
import { subscriptions } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe/client";
import type { Locale } from "@/i18n/config";
import { ACCESS_STATUSES, lookupKey, type OurStatus, type PaidPlanId } from "./plans";

export type CheckoutOutcome =
  | { status: "redirect"; url: string }
  | { status: "unavailable" }
  | { status: "already_subscribed" }
  | { status: "price_missing" };

/** Returns the user's Stripe customer id, creating the customer once if needed. */
async function ensureCustomer(userId: string, email: string | undefined): Promise<string> {
  const stripe = getStripe()!;
  const db = adminDb();
  const [row] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
  if (row?.stripeCustomerId) return row.stripeCustomerId;

  // Idempotency key: a double click cannot create two customers.
  const customer = await stripe.customers.create(
    { email, metadata: { userId } },
    { idempotencyKey: `customer-${userId}` },
  );
  await db.update(subscriptions).set({ stripeCustomerId: customer.id }).where(eq(subscriptions.userId, userId));
  return customer.id;
}

/** Stripe Checkout for a paid plan. `userId`/`email` MUST come from a verified session. */
export async function createCheckout(
  userId: string,
  email: string | undefined,
  plan: PaidPlanId,
  locale: Locale,
): Promise<CheckoutOutcome> {
  const stripe = getStripe();
  if (!stripe) return { status: "unavailable" };

  const [current] = await adminDb().select().from(subscriptions).where(eq(subscriptions.userId, userId));
  if (current?.stripeSubscriptionId && ACCESS_STATUSES.has(current.status as OurStatus)) {
    return { status: "already_subscribed" }; // changing plans happens in the Customer Portal
  }

  const prices = await stripe.prices.list({ lookup_keys: [lookupKey(plan)], active: true, limit: 1 });
  const price = prices.data[0];
  if (!price) return { status: "price_missing" };

  const customer = await ensureCustomer(userId, email);
  const site = env().NEXT_PUBLIC_SITE_URL;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: userId,
    line_items: [{ price: price.id, quantity: 1 }],
    subscription_data: { metadata: { userId } },
    metadata: { userId },
    allow_promotion_codes: true,
    locale: locale === "fr" ? "fr-CA" : "en",
    success_url: `${site}/${locale}/app/billing?checkout=success`,
    cancel_url: `${site}/${locale}/app/billing?checkout=canceled`,
  });
  if (!session.url) throw new Error("Stripe returned a checkout session without URL");
  return { status: "redirect", url: session.url };
}

export async function createPortal(userId: string, locale: Locale): Promise<CheckoutOutcome> {
  const stripe = getStripe();
  if (!stripe) return { status: "unavailable" };
  const [row] = await adminDb().select().from(subscriptions).where(eq(subscriptions.userId, userId));
  if (!row?.stripeCustomerId) return { status: "price_missing" };
  const session = await stripe.billingPortal.sessions.create({
    customer: row.stripeCustomerId,
    return_url: `${env().NEXT_PUBLIC_SITE_URL}/${locale}/app/billing`,
    locale: locale === "fr" ? "fr-CA" : "en",
  });
  return { status: "redirect", url: session.url };
}

/** Immediately cancels any paid subscription (used before deleting an account). */
export async function cancelSubscriptionNow(userId: string): Promise<void> {
  const stripe = getStripe();
  const [row] = await adminDb().select().from(subscriptions).where(eq(subscriptions.userId, userId));
  if (!stripe || !row?.stripeSubscriptionId) return;
  await stripe.subscriptions.cancel(row.stripeSubscriptionId);
}
