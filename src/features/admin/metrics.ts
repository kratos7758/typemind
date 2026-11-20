import "server-only";
import { notFound } from "next/navigation";
import { and, count, countDistinct, eq, gte, inArray, isNotNull, sql, sum } from "drizzle-orm";
import { adminDb } from "@/lib/db/client";
import {
  aiGenerations,
  appAdmins,
  profiles,
  subscriptionPlans,
  subscriptions,
  typingSessions,
} from "@/lib/db/schema";
import { requireClaims } from "@/features/auth/dal";
import { ACCESS_STATUSES, monthlyCents } from "@/features/billing/plans";
import { periodStart } from "@/features/billing/quota";
import type { Locale } from "@/i18n/config";

/** Admin-only pages: non-admins get a 404 (the page's existence is not revealed). */
export async function requireAdmin(locale: Locale) {
  const claims = await requireClaims(locale);
  const [row] = await adminDb().select().from(appAdmins).where(eq(appAdmins.userId, claims.sub));
  if (!row) notFound();
  return claims;
}

/** Aggregated, anonymous product metrics. No personal data leaves this function. */
export async function getAdminMetrics() {
  const db = adminDb();
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600_000);
  const access = [...ACCESS_STATUSES];

  const [[users], [newUsers], [onboarded], [activity], planRows, [pastDue], aiRows] = await Promise.all([
    db.select({ n: count() }).from(profiles),
    db.select({ n: count() }).from(profiles).where(gte(profiles.createdAt, weekAgo)),
    db.select({ n: count() }).from(profiles).where(isNotNull(profiles.onboardingCompletedAt)),
    db
      .select({
        active: countDistinct(typingSessions.userId),
        sessions: count(),
        ms: sum(typingSessions.durationMs),
      })
      .from(typingSessions)
      .where(gte(typingSessions.endedAt, weekAgo)),
    db
      .select({
        planId: subscriptions.planId,
        n: count(),
        priceCents: subscriptionPlans.priceCents,
        interval: subscriptionPlans.interval,
      })
      .from(subscriptions)
      .innerJoin(subscriptionPlans, eq(subscriptionPlans.id, subscriptions.planId))
      .where(inArray(subscriptions.status, access))
      .groupBy(subscriptions.planId, subscriptionPlans.priceCents, subscriptionPlans.interval),
    db.select({ n: count() }).from(subscriptions).where(eq(subscriptions.status, "past_due")),
    db
      .select({ status: aiGenerations.status, n: count(), cost: sum(aiGenerations.costEstimateMicros) })
      .from(aiGenerations)
      .where(and(gte(aiGenerations.createdAt, sql`${periodStart()}::date`)))
      .groupBy(aiGenerations.status),
  ]);

  const paid = planRows.filter((r) => r.interval !== null);
  const ai = (status: string) => aiRows.find((r) => r.status === status)?.n ?? 0;
  return {
    users: users.n,
    newUsers: newUsers.n,
    onboarded: onboarded.n,
    activeUsers: activity.active,
    sessions: activity.sessions,
    practiceHours: Number(activity.ms ?? 0) / 3_600_000,
    plans: planRows.map((r) => ({ planId: r.planId, count: r.n })),
    paidSubscriptions: paid.reduce((a, r) => a + r.n, 0),
    pastDue: pastDue.n,
    mrrCents: paid.reduce((a, r) => a + r.n * monthlyCents(r.priceCents, r.interval), 0),
    ai: {
      succeeded: ai("succeeded"),
      failed: ai("failed"),
      invalid: ai("invalid_output"),
      costMicros: aiRows.reduce((a, r) => a + Number(r.cost ?? 0), 0),
    },
  };
}
