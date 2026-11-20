/**
 * Checkout / Portal calls against stripe-mock (Stripe's official mock API server, Docker).
 * stripe-mock validates requests against Stripe's OpenAPI spec and returns fixtures:
 * this checks that OUR requests are well-formed and that outcomes are handled.
 * It never represents a real payment.
 */
import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { adminDb } from "@/lib/db/client";
import { subscriptions } from "@/lib/db/schema";
import { resetStripeClient } from "@/lib/stripe/client";
import { createCheckout, createPortal } from "@/features/billing/checkout";

const CONTAINER = "typemind-stripe-mock";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
let userId: string;

async function waitForMock() {
  for (let i = 0; i < 40; i++) {
    try {
      await fetch("http://127.0.0.1:12111/v1/prices", { headers: { Authorization: "Bearer sk_test_123" } });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error("stripe-mock did not start");
}

beforeAll(async () => {
  const running = execSync(`docker ps -q -f name=${CONTAINER}`).toString().trim();
  if (!running) {
    execSync(`docker rm -f ${CONTAINER}`, { stdio: "ignore" });
    execSync(`docker run -d --name ${CONTAINER} -p 12111:12111 stripe/stripe-mock:latest`, { stdio: "ignore" });
  }
  await waitForMock();

  process.env.STRIPE_SECRET_KEY = "sk_test_123";
  process.env.STRIPE_API_HOST = "127.0.0.1";
  process.env.STRIPE_API_PORT = "12111";
  process.env.STRIPE_API_PROTOCOL = "http";
  resetStripeClient();

  const { data, error } = await admin.auth.admin.createUser({
    email: `checkout-${crypto.randomUUID()}@example.test`,
    password: "integration-test-password",
    email_confirm: true,
  });
  if (error) throw error;
  userId = data.user!.id;
}, 60_000);

afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId);
});

describe("createCheckout (stripe-mock)", () => {
  it("creates a customer once and returns a Checkout URL", async () => {
    const outcome = await createCheckout(userId, "user@example.test", "pro_monthly", "fr");
    expect(outcome.status).toBe("redirect");
    if (outcome.status === "redirect") expect(outcome.url).toMatch(/^https:\/\//);
    const [row] = await adminDb().select().from(subscriptions).where(eq(subscriptions.userId, userId));
    expect(row.stripeCustomerId).toMatch(/^cus_/);

    const again = await createCheckout(userId, "user@example.test", "pro_yearly", "en");
    expect(again.status).toBe("redirect");
    const [after] = await adminDb().select().from(subscriptions).where(eq(subscriptions.userId, userId));
    expect(after.stripeCustomerId).toBe(row.stripeCustomerId); // reused, not duplicated
  });

  it("refuses a second subscription while one is active", async () => {
    await adminDb()
      .update(subscriptions)
      .set({ planId: "pro_monthly", status: "active", stripeSubscriptionId: "sub_existing" })
      .where(eq(subscriptions.userId, userId));
    expect(await createCheckout(userId, undefined, "pro_yearly", "fr")).toEqual({ status: "already_subscribed" });
  });

  it("opens the Customer Portal for an existing customer", async () => {
    const outcome = await createPortal(userId, "fr");
    expect(outcome.status).toBe("redirect");
  });

  it("reports billing as unavailable without a secret key", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    resetStripeClient();
    // env() caches the parsed environment per module instance: re-import fresh.
    const { vi } = await import("vitest");
    vi.resetModules();
    const fresh = await import("@/features/billing/checkout");
    expect(await fresh.createCheckout(userId, undefined, "pro_monthly", "fr")).toEqual({ status: "unavailable" });
  });
});
