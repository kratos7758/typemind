import "server-only";
import { eq } from "drizzle-orm";
import { withUserDb, type JwtClaims } from "@/lib/db/client";
import {
  aiGenerations,
  bigramStatistics,
  exercises,
  keyStatistics,
  learningProfiles,
  profiles,
  sessionStatistics,
  subscriptions,
  typingSessions,
  usageQuotas,
  userInterests,
  userPreferences,
} from "@/lib/db/schema";

/**
 * Everything we hold about the user, read as the user (RLS) — right of access /
 * portability (Quebec Law 25, GDPR art. 15/20). Internal ids of third parties
 * (Stripe customer/subscription ids) are left out; typed text is never stored.
 */
export async function exportUserData(claims: JwtClaims) {
  return withUserDb(claims, async (tx) => {
    const [profile] = await tx.select().from(profiles).where(eq(profiles.id, claims.sub));
    const [subscription] = await tx
      .select({
        planId: subscriptions.planId,
        status: subscriptions.status,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      })
      .from(subscriptions);
    return {
      exportedAt: new Date().toISOString(),
      account: { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null },
      profile,
      preferences: await tx.select().from(userPreferences),
      interests: await tx.select().from(userInterests),
      learningProfile: await tx.select().from(learningProfiles),
      subscription: subscription ?? null,
      usageQuotas: await tx.select().from(usageQuotas),
      sessions: await tx
        .select({ session: typingSessions, statistics: sessionStatistics })
        .from(typingSessions)
        .leftJoin(sessionStatistics, eq(sessionStatistics.sessionId, typingSessions.id)),
      keyStatistics: await tx.select().from(keyStatistics),
      bigramStatistics: await tx.select().from(bigramStatistics),
      aiExercises: await tx.select().from(exercises).where(eq(exercises.ownerId, claims.sub)),
      aiGenerations: await tx.select().from(aiGenerations),
    };
  });
}
