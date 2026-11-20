import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { adminDb } from "@/lib/db/client";
import { subscriptionPlans, subscriptions } from "@/lib/db/schema";
import { ACCESS_STATUSES } from "./plans";

/** Shape of subscription_plans.entitlements (validated: the DB is edited by admins). */
export const entitlementsSchema = z.object({
  aiGenerationsPerMonth: z.number().int().min(0),
  historyDays: z.number().int().positive().nullable(),
  aiCoach: z.boolean(),
  advancedAnalytics: z.boolean(),
});
export type Entitlements = z.infer<typeof entitlementsSchema> & { planId: string };

/** Used when the plan row is missing or malformed: the most restrictive set. */
const FALLBACK: Entitlements = {
  planId: "free",
  aiGenerationsPerMonth: 0,
  historyDays: 7,
  aiCoach: false,
  advancedAnalytics: false,
};


/**
 * Server-side source of truth for what a user may do (never the client).
 * A paid subscription without access (unpaid, canceled, paused…) falls back to the Free plan.
 */
export async function getEntitlements(userId: string): Promise<Entitlements> {
  const db = adminDb();
  const [row] = await db
    .select({ planId: subscriptions.planId, status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId));
  const planId = row && ACCESS_STATUSES.has(row.status) ? row.planId : "free";

  const [plan] = await db
    .select({ entitlements: subscriptionPlans.entitlements, isActive: subscriptionPlans.isActive })
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, planId));
  const parsed = entitlementsSchema.safeParse(plan?.entitlements);
  if (!parsed.success) {
    console.error("Invalid entitlements for plan", planId);
    return FALLBACK;
  }
  return { ...parsed.data, planId };
}
