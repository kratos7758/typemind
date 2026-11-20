import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";

let cached: Stripe | null | undefined;

/**
 * Stripe client, or null when billing is not configured (no secret key).
 * Callers must handle null and tell the user billing is unavailable —
 * a payment is never simulated.
 */
export function getStripe(): Stripe | null {
  if (cached !== undefined) return cached;
  const e = env();
  if (!e.STRIPE_SECRET_KEY) {
    cached = null;
    return cached;
  }
  cached = new Stripe(e.STRIPE_SECRET_KEY, {
    maxNetworkRetries: 2,
    timeout: 20_000,
    appInfo: { name: "TypeMind" },
    ...(e.STRIPE_API_HOST
      ? { host: e.STRIPE_API_HOST, port: e.STRIPE_API_PORT, protocol: e.STRIPE_API_PROTOCOL ?? "https" }
      : {}),
  });
  return cached;
}

/** For tests: forget the cached client after changing environment variables. */
export function resetStripeClient() {
  cached = undefined;
}
