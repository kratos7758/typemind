import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { env } from "@/lib/env";
import { handleStripeEvent } from "@/features/billing/webhook";

/**
 * Stripe webhook. The signature is verified on the RAW body before anything else;
 * unsigned or tampered requests are rejected. 2xx tells Stripe the event is handled;
 * a 5xx makes Stripe retry (the handler is idempotent).
 */
export async function POST(request: NextRequest) {
  const secret = env().STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "billing_not_configured" }, { status: 503 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "missing_signature" }, { status: 400 });

  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(raw, signature, secret);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  try {
    const outcome = await handleStripeEvent(event);
    return NextResponse.json({ received: true, outcome });
  } catch (error) {
    console.error("Stripe webhook failed", event.type, error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
