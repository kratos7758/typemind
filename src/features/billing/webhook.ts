import "server-only";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { adminDb, type Tx } from "@/lib/db/client";
import { stripeEvents, subscriptionPlans, subscriptions } from "@/lib/db/schema";
import { mapStatus, planFromLookupKey } from "./plans";

export type WebhookOutcome = "processed" | "duplicate" | "stale" | "ignored";

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
]);

/**
 * Applies a VERIFIED Stripe event (signature checked by the caller).
 * - Idempotent: the event id is recorded in the same transaction as its effect;
 *   a redelivered event is a no-op. If anything fails, the transaction rolls back
 *   and Stripe retries.
 * - Order-safe: an event older than the last one applied to the subscription is ignored.
 * - Never trusts client data: the user is identified by metadata we set server-side
 *   at checkout, or by the Stripe customer id we stored.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<WebhookOutcome> {
  return adminDb().transaction(async (tx) => {
    const [recorded] = await tx
      .insert(stripeEvents)
      .values({ id: event.id, type: event.type })
      .onConflictDoNothing()
      .returning({ id: stripeEvents.id });
    if (!recorded) return "duplicate";

    if (event.type === "checkout.session.completed") {
      return linkCustomer(tx, event.data.object as Stripe.Checkout.Session);
    }
    if (SUBSCRIPTION_EVENTS.has(event.type)) {
      return applySubscription(tx, event.data.object as Stripe.Subscription, event);
    }
    return "ignored";
  });
}

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : (v?.id ?? null));

async function linkCustomer(tx: Tx, session: Stripe.Checkout.Session): Promise<WebhookOutcome> {
  const userId = session.client_reference_id ?? session.metadata?.userId;
  const customerId = idOf(session.customer);
  if (!userId || !customerId) return "ignored";
  await tx.update(subscriptions).set({ stripeCustomerId: customerId }).where(eq(subscriptions.userId, userId));
  return "processed";
}

async function resolvePlan(tx: Tx, sub: Stripe.Subscription): Promise<string | null> {
  const price = sub.items.data[0]?.price;
  const fromKey = planFromLookupKey(price?.lookup_key);
  if (fromKey) return fromKey;
  if (!price?.id) return null;
  const [plan] = await tx
    .select({ id: subscriptionPlans.id })
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.stripePriceId, price.id));
  return plan?.id ?? null;
}

async function applySubscription(tx: Tx, sub: Stripe.Subscription, event: Stripe.Event): Promise<WebhookOutcome> {
  const customerId = idOf(sub.customer);
  const userId = sub.metadata?.userId;
  const [row] = userId
    ? await tx.select().from(subscriptions).where(eq(subscriptions.userId, userId)).for("update")
    : customerId
      ? await tx.select().from(subscriptions).where(eq(subscriptions.stripeCustomerId, customerId)).for("update")
      : [];
  if (!row) {
    console.error("Stripe subscription for unknown user", sub.id);
    return "ignored";
  }

  const eventTime = new Date(event.created * 1000);
  if (row.stripeUpdatedAt && eventTime < row.stripeUpdatedAt) return "stale";

  // A user who replaced one subscription with another: ignore late events of the old one.
  if (row.stripeSubscriptionId && row.stripeSubscriptionId !== sub.id && event.type === "customer.subscription.deleted") {
    await tx.update(subscriptions).set({ stripeUpdatedAt: eventTime }).where(eq(subscriptions.id, row.id));
    return "stale";
  }

  const ended = event.type === "customer.subscription.deleted" || sub.status === "canceled" || sub.status === "incomplete_expired";
  if (ended) {
    await tx
      .update(subscriptions)
      .set({
        planId: "free",
        status: "active",
        stripeSubscriptionId: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        stripeCustomerId: customerId ?? row.stripeCustomerId,
        stripeUpdatedAt: eventTime,
      })
      .where(eq(subscriptions.id, row.id));
    return "processed";
  }

  const planId = await resolvePlan(tx, sub);
  if (!planId) {
    console.error("Stripe subscription with an unknown price", sub.id);
    return "ignored";
  }
  const periodEnd = sub.items.data[0]?.current_period_end;
  await tx
    .update(subscriptions)
    .set({
      planId,
      status: mapStatus(sub.status),
      stripeSubscriptionId: sub.id,
      stripeCustomerId: customerId ?? row.stripeCustomerId,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      stripeUpdatedAt: eventTime,
    })
    .where(eq(subscriptions.id, row.id));
  return "processed";
}
