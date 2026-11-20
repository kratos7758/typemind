import "server-only";
import { and, desc, eq, gte, like, sql } from "drizzle-orm";
import { withUserDb, type JwtClaims } from "@/lib/db/client";
import {
  bigramStatistics,
  exercises,
  keyStatistics,
  learningProfiles,
  profiles,
  sessionStatistics,
  subscriptionPlans,
  subscriptions,
  typingSessions,
  userInterests,
  userPreferences,
} from "@/lib/db/schema";
import { isLayoutId, type LayoutId } from "@/features/typing-engine/layouts";
import { isTopic, type TopicKey } from "@/content/topics";
import { LESSON_PASS_ACCURACY } from "@/content/lessons";
import { LEARNING_CONFIG, localDate } from "@/features/learning/profile";
import { ACCESS_STATUSES } from "@/features/billing/plans";
import type { Locale } from "@/i18n/config";

export type UserContext = {
  userId: string;
  displayName: string | null;
  onboardingCompleted: boolean;
  planName: string;
  /** Plan granting access right now (inactive paid subscriptions count as free). */
  planId: string;
  layoutId: LayoutId;
  contentLanguage: Locale;
  experience: "never" | "beginner" | "intermediate" | "advanced" | null;
  goals: string[];
  dailyGoalMinutes: number;
  timeZone: string | null;
  showVirtualKeyboard: boolean;
  interests: TopicKey[];
  learning: typeof learningProfiles.$inferSelect | null;
};

/** Everything a page needs about the signed-in user, read under RLS (ADR-004). */
export async function getUserContext(claims: JwtClaims): Promise<UserContext> {
  return withUserDb(claims, async (tx) => {
    const [row] = await tx
      .select({
        displayName: profiles.displayName,
        onboardingCompletedAt: profiles.onboardingCompletedAt,
        planName: subscriptionPlans.name,
        planId: subscriptions.planId,
        subStatus: subscriptions.status,
        prefs: userPreferences,
      })
      .from(profiles)
      .leftJoin(userPreferences, eq(userPreferences.userId, profiles.id))
      .leftJoin(subscriptions, eq(subscriptions.userId, profiles.id))
      .leftJoin(subscriptionPlans, eq(subscriptionPlans.id, subscriptions.planId))
      .where(eq(profiles.id, claims.sub))
      .limit(1);

    const interests = await tx
      .select({ topic: userInterests.topicKey })
      .from(userInterests)
      .where(eq(userInterests.userId, claims.sub));
    const [learning] = await tx.select().from(learningProfiles).where(eq(learningProfiles.userId, claims.sub));

    const prefs = row?.prefs;
    return {
      userId: claims.sub,
      displayName: row?.displayName ?? null,
      onboardingCompleted: Boolean(row?.onboardingCompletedAt),
      planName: row?.planName ?? "Free",
      planId: row?.planId && row.subStatus && ACCESS_STATUSES.has(row.subStatus) ? row.planId : "free",
      layoutId: prefs && isLayoutId(prefs.keyboardLayoutId) ? prefs.keyboardLayoutId : "fr-azerty",
      contentLanguage: prefs?.contentLanguage ?? "fr",
      experience: prefs?.experienceLevel ?? null,
      goals: prefs?.goals ?? [],
      dailyGoalMinutes: prefs?.dailyGoalMinutes ?? 10,
      timeZone: prefs?.timeZone ?? null,
      showVirtualKeyboard: prefs?.showVirtualKeyboard ?? true,
      interests: interests.map((i) => i.topic).filter(isTopic),
      learning: learning ?? null,
    };
  });
}

export type RecentSession = {
  id: string;
  mode: string;
  exerciseKey: string | null;
  endedAt: Date;
  durationMs: number;
  netWpm: number | null;
  accuracy: number | null;
};

export async function getRecentSessions(claims: JwtClaims, limit = 8): Promise<RecentSession[]> {
  return withUserDb(claims, (tx) =>
    tx
      .select({
        id: typingSessions.id,
        mode: typingSessions.mode,
        exerciseKey: typingSessions.exerciseKey,
        endedAt: typingSessions.endedAt,
        durationMs: typingSessions.durationMs,
        netWpm: sessionStatistics.netWpm,
        accuracy: sessionStatistics.accuracy,
      })
      .from(typingSessions)
      .leftJoin(sessionStatistics, eq(sessionStatistics.sessionId, typingSessions.id))
      .orderBy(desc(typingSessions.endedAt))
      .limit(limit),
  );
}

/** Active practice time today, in the user's time zone. */
export async function getPracticeMsToday(claims: JwtClaims, timeZone: string | null): Promise<number> {
  const now = new Date();
  const today = localDate(now, timeZone ?? undefined);
  // Sessions from the last 36 h, then filtered precisely by local date.
  const since = new Date(now.getTime() - 36 * 3600_000);
  const rows = await withUserDb(claims, (tx) =>
    tx
      .select({ endedAt: typingSessions.endedAt, durationMs: typingSessions.durationMs })
      .from(typingSessions)
      .where(gte(typingSessions.endedAt, since)),
  );
  return rows
    .filter((r) => localDate(r.endedAt, timeZone ?? undefined) === today)
    .reduce((sum, r) => sum + r.durationMs, 0);
}

/** Lessons passed at least once with the required accuracy. */
export async function getPassedLessons(claims: JwtClaims): Promise<Set<string>> {
  const rows = await withUserDb(claims, (tx) =>
    tx
      .selectDistinct({ key: typingSessions.exerciseKey })
      .from(typingSessions)
      .innerJoin(sessionStatistics, eq(sessionStatistics.sessionId, typingSessions.id))
      .where(
        and(
          like(typingSessions.exerciseKey, "lesson:%"),
          gte(sessionStatistics.accuracy, LESSON_PASS_ACCURACY),
          eq(typingSessions.status, "completed"),
        ),
      ),
  );
  return new Set(rows.map((r) => (r.key ?? "").replace(/^lesson:/, "")));
}

export async function getRecentExerciseKeys(claims: JwtClaims, limit = 30): Promise<string[]> {
  const rows = await withUserDb(claims, (tx) =>
    tx
      .select({ key: typingSessions.exerciseKey })
      .from(typingSessions)
      .where(sql`${typingSessions.exerciseKey} is not null`)
      .orderBy(desc(typingSessions.endedAt))
      .limit(limit),
  );
  return rows.map((r) => r.key!);
}

/** An AI exercise owned by the user (RLS hides other users' private exercises). */
export async function getAiExercise(claims: JwtClaims, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await withUserDb(claims, (tx) =>
    tx
      .select({
        id: exercises.id,
        title: exercises.title,
        body: exercises.body,
        language: exercises.language,
        targetChars: exercises.targetChars,
      })
      .from(exercises)
      .where(and(eq(exercises.id, id), eq(exercises.kind, "ai"))),
  );
  return row ?? null;
}

/** Hard cap on how far back analytics look, whatever the plan. */
export const ANALYTICS_MAX_DAYS = 90;

/**
 * Analytics data. `historyDays` comes from server-side entitlements (Free: 7);
 * the time window is enforced HERE, not in the UI.
 */
export async function getAnalyticsData(claims: JwtClaims, layoutId: string, historyDays: number | null) {
  const days = Math.min(historyDays ?? ANALYTICS_MAX_DAYS, ANALYTICS_MAX_DAYS);
  const since = new Date(Date.now() - days * 24 * 3600_000);
  return withUserDb(claims, async (tx) => {
    const sessions = await tx
      .select({
        mode: typingSessions.mode,
        status: typingSessions.status,
        endedAt: typingSessions.endedAt,
        durationMs: typingSessions.durationMs,
        netWpm: sessionStatistics.netWpm,
        accuracy: sessionStatistics.accuracy,
        keystrokes: sessionStatistics.keystrokes,
      })
      .from(typingSessions)
      .leftJoin(sessionStatistics, eq(sessionStatistics.sessionId, typingSessions.id))
      .where(gte(typingSessions.endedAt, since))
      .orderBy(typingSessions.endedAt);
    const keys = await tx
      .select({
        char: keyStatistics.char,
        attempts: keyStatistics.attempts,
        errors: keyStatistics.errors,
        ewmaErrorRate: keyStatistics.ewmaErrorRate,
        ewmaLatencyMs: keyStatistics.ewmaLatencyMs,
      })
      .from(keyStatistics)
      .where(eq(keyStatistics.layoutId, layoutId));
    const bigrams = await tx
      .select({ bigram: bigramStatistics.bigram, attempts: bigramStatistics.attempts, ewmaErrorRate: bigramStatistics.ewmaErrorRate })
      .from(bigramStatistics)
      .where(and(
          eq(bigramStatistics.layoutId, layoutId),
          gte(bigramStatistics.attempts, LEARNING_CONFIG.weakBigram.minAttempts),
          gte(bigramStatistics.ewmaErrorRate, LEARNING_CONFIG.weakBigram.minErrorRate),
        ))
      .orderBy(desc(bigramStatistics.ewmaErrorRate))
      .limit(8);
    return { days, sessions, keys, bigrams };
  });
}
