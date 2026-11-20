/**
 * Creates (or finds) the TypeMind product and prices in Stripe, identified by lookup keys,
 * from the plans stored in the database. Idempotent: safe to run several times.
 *
 *   npm run stripe:setup            (uses STRIPE_SECRET_KEY and DATABASE_URL from .env.local)
 *
 * Use TEST mode keys (sk_test_…) until launch. Prices come from subscription_plans
 * (price_cents, currency, interval) — the database stays the single source of truth.
 */
import { readFileSync, existsSync } from "node:fs";
import Stripe from "stripe";
import postgres from "postgres";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && m[2] !== "" && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY is missing (.env.local). Use a test key: sk_test_…");
  process.exit(1);
}
if (key.startsWith("sk_live_") && process.env.ALLOW_LIVE !== "1") {
  console.error("Refusing to run with a LIVE key. Set ALLOW_LIVE=1 if you really mean it.");
  process.exit(1);
}

const stripe = new Stripe(key, {
  ...(process.env.STRIPE_API_HOST
    ? {
        host: process.env.STRIPE_API_HOST,
        port: Number(process.env.STRIPE_API_PORT),
        protocol: (process.env.STRIPE_API_PROTOCOL as "http" | "https") ?? "https",
      }
    : {}),
});
const sql = postgres(process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres");

type PlanRow = { id: string; name: string; price_cents: number; currency: string; interval: "month" | "year" | null };

try {
  const plans = await sql<PlanRow[]>`
    select id, name, price_cents, currency, interval from subscription_plans
    where interval is not null and is_active order by id`;

  const existingProducts = await stripe.products.search({ query: "metadata['app']:'typemind'" });
  const product =
    existingProducts.data[0] ??
    (await stripe.products.create({ name: "TypeMind Pro", metadata: { app: "typemind" } }));
  console.log(`Product: ${product.id}`);

  for (const plan of plans) {
    const lookup = `typemind_${plan.id}`;
    const found = await stripe.prices.list({ lookup_keys: [lookup], active: true, limit: 1 });
    let price = found.data[0];
    const matches =
      price && price.unit_amount === plan.price_cents && price.currency === plan.currency && price.recurring?.interval === plan.interval;
    if (!price || !matches) {
      // transfer_lookup_key moves the key to the new price when the amount changed.
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.price_cents,
        currency: plan.currency,
        recurring: { interval: plan.interval! },
        lookup_key: lookup,
        transfer_lookup_key: true,
        nickname: plan.name,
      });
      console.log(`Created price ${price.id} for ${plan.id}`);
    } else {
      console.log(`Price for ${plan.id} already up to date: ${price.id}`);
    }
    await sql`update subscription_plans set stripe_price_id = ${price.id} where id = ${plan.id}`;
  }
  console.log("Done. Configure the Customer Portal in the Stripe dashboard (plan switching, cancellation).");
} finally {
  await sql.end();
}
