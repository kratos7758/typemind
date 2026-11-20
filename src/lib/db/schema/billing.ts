import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { id, ownerReadOnly, publicRead, timestamps, userId } from "./_shared";

export const subscriptionStatus = pgEnum("subscription_status", [
  "active",
  "trialing",
  "past_due",
  "canceled",
  "incomplete",
  "unpaid",
  "paused",
]);

export const quotaFeature = pgEnum("quota_feature", ["ai_generation", "ai_coach_message"]);

/**
 * Commercial plans. Prices and entitlements live here — never hardcoded.
 * entitlements example: { "aiGenerationsPerMonth": 3, "historyDays": 7, "aiCoach": false }
 */
export const subscriptionPlans = pgTable(
  "subscription_plans",
  {
    id: text("id").primaryKey(), // "free" | "pro_monthly" | "pro_yearly"
    name: text("name").notNull(),
    stripePriceId: text("stripe_price_id").unique(),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("cad"),
    interval: text("interval", { enum: ["month", "year"] }),
    entitlements: jsonb("entitlements").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  () => [...publicRead("subscription_plans")],
).enableRLS();

/** Written only by the Stripe webhook / signup trigger (service role). */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: id(),
    userId: userId().unique(),
    planId: text("plan_id")
      .notNull()
      .references(() => subscriptionPlans.id),
    status: subscriptionStatus("status").notNull().default("active"),
    stripeCustomerId: text("stripe_customer_id").unique(),
    stripeSubscriptionId: text("stripe_subscription_id").unique(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    /** Creation time of the last Stripe event applied: older events arriving late are ignored. */
    stripeUpdatedAt: timestamp("stripe_updated_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [...ownerReadOnly("subscriptions", t.userId)],
).enableRLS();

/**
 * Monthly usage counters. Consumption is an atomic
 * `UPDATE … SET used = used + 1 WHERE used < quota_limit RETURNING` (ADR-006).
 */
export const usageQuotas = pgTable(
  "usage_quotas",
  {
    id: id(),
    userId: userId(),
    feature: quotaFeature("feature").notNull(),
    periodStart: date("period_start").notNull(),
    used: integer("used").notNull().default(0),
    quotaLimit: integer("quota_limit").notNull(),
    ...timestamps,
  },
  (t) => [
    unique("usage_quotas_user_feature_period").on(t.userId, t.feature, t.periodStart),
    check("used_within_bounds", sql`${t.used} >= 0 and ${t.used} <= ${t.quotaLimit}`),
    ...ownerReadOnly("usage_quotas", t.userId),
  ],
).enableRLS();

export const aiGenerations = pgTable(
  "ai_generations",
  {
    id: id(),
    userId: userId(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    purpose: text("purpose", { enum: ["exercise", "coach", "explanation"] }).notNull(),
    status: text("status", { enum: ["succeeded", "failed", "invalid_output"] }).notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    costEstimateMicros: bigint("cost_estimate_micros", { mode: "number" }),
    errorCode: text("error_code"),
    exerciseId: uuid("exercise_id"),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index("ai_generations_user_idx").on(t.userId, t.createdAt.desc()),
    ...ownerReadOnly("ai_generations", t.userId),
  ],
).enableRLS();

/** Processed Stripe event ids (webhook idempotency). No client access at all. */
export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();
