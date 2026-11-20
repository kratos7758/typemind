/**
 * Stripe webhook handling against the local database. Events are built locally and
 * signed with Stripe's own test helper: this verifies OUR handling (signature, idempotency,
 * ordering, entitlements), without any network call or simulated payment.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { adminDb } from "@/lib/db/client";
import { subscriptions } from "@/lib/db/schema";
import { handleStripeEvent } from "@/features/billing/webhook";
import { getEntitlements } from "@/features/billing/entitlements";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
let userId: string;
const customerId = `cus_test_${crypto.randomUUID().slice(0, 8)}`;
const subId = `sub_test_${crypto.randomUUID().slice(0, 8)}`;
let clock = Math.floor(Date.now() / 1000) - 1000;

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email: `stripe-${crypto.randomUUID()}@example.test`,
    password: "integration-test-password",
    email_confirm: true,
  });
  if (error) throw error;
  userId = data.user!.id;
});

afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId);
});

function subscriptionEvent(
  type: string,
  overrides: { status?: string; lookupKey?: string; created?: number; cancelAtPeriodEnd?: boolean; id?: string } = {},
): Stripe.Event {
  const created = overrides.created ?? ++clock;
  return {
    id: `evt_${crypto.randomUUID()}`,
    object: "event",
    type,
    created,
    data: {
      object: {
        id: overrides.id ?? subId,
        object: "subscription",
        customer: customerId,
        status: overrides.status ?? "active",
        cancel_at_period_end: overrides.cancelAtPeriodEnd ?? false,
        metadata: { userId },
        items: {
          data: [
            {
              current_period_end: created + 30 * 86_400,
              price: { id: "price_test", lookup_key: overrides.lookupKey ?? "typemind_pro_monthly" },
            },
          ],
        },
      },
    },
  } as unknown as Stripe.Event;
}

const row = async () => (await adminDb().select().from(subscriptions).where(eq(subscriptions.userId, userId)))[0];

describe("signature verification (Stripe's own implementation)", () => {
  const secret = "whsec_test_secret";
  it("accepts a correctly signed payload and rejects a tampered one", () => {
    const payload = JSON.stringify(subscriptionEvent("customer.subscription.updated"));
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
    expect(Stripe.webhooks.constructEvent(payload, header, secret).type).toBe("customer.subscription.updated");
    const tampered = payload.replace("pro_monthly", "pro_yearly");
    expect(() => Stripe.webhooks.constructEvent(tampered, header, secret)).toThrow();
    expect(() => Stripe.webhooks.constructEvent(payload, header, "whsec_other")).toThrow();
  });
});

describe("handleStripeEvent", () => {
  it("checkout completion links the Stripe customer", async () => {
    const event = {
      id: `evt_${crypto.randomUUID()}`,
      type: "checkout.session.completed",
      created: ++clock,
      data: { object: { client_reference_id: userId, customer: customerId, metadata: { userId } } },
    } as unknown as Stripe.Event;
    expect(await handleStripeEvent(event)).toBe("processed");
    expect((await row()).stripeCustomerId).toBe(customerId);
  });

  it("an active subscription grants Pro entitlements", async () => {
    expect(await handleStripeEvent(subscriptionEvent("customer.subscription.created"))).toBe("processed");
    expect(await row()).toMatchObject({ planId: "pro_monthly", status: "active", stripeSubscriptionId: subId });
    expect(await getEntitlements(userId)).toMatchObject({ planId: "pro_monthly", aiGenerationsPerMonth: 150, historyDays: null });
  });

  it("a redelivered event is a no-op", async () => {
    const event = subscriptionEvent("customer.subscription.updated", { lookupKey: "typemind_pro_yearly" });
    expect(await handleStripeEvent(event)).toBe("processed");
    expect(await handleStripeEvent(event)).toBe("duplicate");
    expect((await row()).planId).toBe("pro_yearly");
  });

  it("an older event arriving late is ignored", async () => {
    const stale = subscriptionEvent("customer.subscription.updated", { lookupKey: "typemind_pro_monthly", created: clock - 500 });
    expect(await handleStripeEvent(stale)).toBe("stale");
    expect((await row()).planId).toBe("pro_yearly");
  });

  it("past_due keeps access during payment retries, unpaid removes it", async () => {
    await handleStripeEvent(subscriptionEvent("customer.subscription.updated", { status: "past_due", lookupKey: "typemind_pro_yearly" }));
    expect((await getEntitlements(userId)).planId).toBe("pro_yearly");
    await handleStripeEvent(subscriptionEvent("customer.subscription.updated", { status: "unpaid", lookupKey: "typemind_pro_yearly" }));
    expect(await getEntitlements(userId)).toMatchObject({ planId: "free", aiGenerationsPerMonth: 3, historyDays: 7 });
  });

  it("records a scheduled cancellation without removing access", async () => {
    await handleStripeEvent(subscriptionEvent("customer.subscription.updated", { cancelAtPeriodEnd: true }));
    expect(await row()).toMatchObject({ status: "active", cancelAtPeriodEnd: true });
    expect((await getEntitlements(userId)).planId).toBe("pro_monthly");
  });

  it("deletion returns the user to Free and keeps the customer", async () => {
    expect(await handleStripeEvent(subscriptionEvent("customer.subscription.deleted", { status: "canceled" }))).toBe("processed");
    expect(await row()).toMatchObject({ planId: "free", status: "active", stripeSubscriptionId: null, stripeCustomerId: customerId });
  });

  it("ignores unknown prices and unrelated event types (but records them)", async () => {
    expect(await handleStripeEvent(subscriptionEvent("customer.subscription.updated", { lookupKey: "someone_else" }))).toBe("ignored");
    expect((await row()).planId).toBe("free");
    const other = { id: `evt_${crypto.randomUUID()}`, type: "invoice.paid", created: ++clock, data: { object: {} } } as unknown as Stripe.Event;
    expect(await handleStripeEvent(other)).toBe("ignored");
    expect(await handleStripeEvent(other)).toBe("duplicate");
  });
});
