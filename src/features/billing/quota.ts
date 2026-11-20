import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { adminDb } from "@/lib/db/client";
import { usageQuotas } from "@/lib/db/schema";

export type QuotaFeature = "ai_generation" | "ai_coach_message";

/** Monthly periods, UTC (first day of the month as YYYY-MM-DD). */
export const periodStart = (now: Date = new Date()) =>
  `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;

export type QuotaState = { used: number; limit: number };

/**
 * Atomically consumes one unit (ADR-006). The conditional UPDATE locks the row, so
 * concurrent requests cannot exceed the limit. Returns null when the quota is exhausted.
 * The stored limit follows the current plan but never drops below what was already used.
 */
export async function consumeQuota(userId: string, feature: QuotaFeature, limit: number): Promise<QuotaState | null> {
  const db = adminDb();
  const period = periodStart();
  await db
    .insert(usageQuotas)
    .values({ userId, feature, periodStart: period, used: 0, quotaLimit: limit })
    .onConflictDoUpdate({
      target: [usageQuotas.userId, usageQuotas.feature, usageQuotas.periodStart],
      set: { quotaLimit: sql`greatest(${limit}, ${usageQuotas.used})` },
    });

  const [row] = await db
    .update(usageQuotas)
    .set({ used: sql`${usageQuotas.used} + 1` })
    .where(
      and(
        eq(usageQuotas.userId, userId),
        eq(usageQuotas.feature, feature),
        eq(usageQuotas.periodStart, period),
        sql`${usageQuotas.used} < ${usageQuotas.quotaLimit}`,
      ),
    )
    .returning({ used: usageQuotas.used, limit: usageQuotas.quotaLimit });
  return row ?? null;
}

/** Gives back a unit after a failed generation (the user is not charged for our errors). */
export async function refundQuota(userId: string, feature: QuotaFeature): Promise<void> {
  await adminDb()
    .update(usageQuotas)
    .set({ used: sql`greatest(${usageQuotas.used} - 1, 0)` })
    .where(
      and(eq(usageQuotas.userId, userId), eq(usageQuotas.feature, feature), eq(usageQuotas.periodStart, periodStart())),
    );
}

export async function getQuota(userId: string, feature: QuotaFeature, limit: number): Promise<QuotaState> {
  const [row] = await adminDb()
    .select({ used: usageQuotas.used, limit: usageQuotas.quotaLimit })
    .from(usageQuotas)
    .where(
      and(eq(usageQuotas.userId, userId), eq(usageQuotas.feature, feature), eq(usageQuotas.periodStart, periodStart())),
    );
  return { used: row?.used ?? 0, limit: Math.max(limit, row?.used ?? 0) };
}
