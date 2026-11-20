import "server-only";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { computeTrend, TREND_CONFIG } from "@/features/learning/trends";
import { adminDb, type Tx } from "@/lib/db/client";
import {
  bigramStatistics,
  keyStatistics,
  learningProfiles,
  sessionStatistics,
  typingSessions,
} from "@/lib/db/schema";
import { headline, mergeKeyStat, type StoredKeyStat } from "@/features/learning/key-stats";
import { isReliableAssessment, LEARNING_CONFIG, pickWeak, updateProfile, type SkillLevel } from "@/features/learning/profile";
import type { KeyStat } from "@/features/typing-engine/stats";
import type { SessionPayload } from "./schema";

export type RecordResult = {
  sessionId: string;
  duplicate: boolean;
  netWpm: number;
  accuracy: number;
  skillLevel: SkillLevel | null;
  assessmentReliable: boolean | null;
};

/**
 * Persists a completed exercise and updates the learning profile, atomically.
 * Privileged write (ADR-012): `userId` MUST come from a verified session.
 * Idempotent on (userId, clientSessionId) so offline retries are safe.
 */
export async function recordSession(userId: string, p: SessionPayload): Promise<RecordResult> {
  const numbers = headline(p.summary);

  return adminDb().transaction(async (tx) => {
    const [inserted] = await tx
      .insert(typingSessions)
      .values({
        userId,
        exerciseKey: p.exerciseKey,
        layoutId: p.layoutId,
        mode: p.mode,
        status: p.completed ? "completed" : "abandoned",
        clientSessionId: p.clientSessionId,
        startedAt: new Date(p.startedAt),
        endedAt: new Date(p.endedAt),
        durationMs: p.summary.durationMs,
      })
      .onConflictDoNothing({ target: [typingSessions.userId, typingSessions.clientSessionId] })
      .returning({ id: typingSessions.id });

    if (!inserted) {
      const [existing] = await tx
        .select({ id: typingSessions.id })
        .from(typingSessions)
        .where(and(eq(typingSessions.userId, userId), eq(typingSessions.clientSessionId, p.clientSessionId)));
      const [profile] = await tx.select().from(learningProfiles).where(eq(learningProfiles.userId, userId));
      return {
        sessionId: existing.id,
        duplicate: true,
        ...numbers,
        skillLevel: profile?.skillLevel ?? null,
        assessmentReliable: null,
      };
    }

    await tx.insert(sessionStatistics).values({
      sessionId: inserted.id,
      userId,
      netWpm: numbers.netWpm,
      rawWpm: numbers.rawWpm,
      accuracy: numbers.accuracy,
      keystrokes: p.summary.keystrokes,
      correctKeystrokes: p.summary.correctKeystrokes,
      correctChars: p.summary.correctChars,
      correctedErrors: p.summary.correctedErrors,
      uncorrectedErrors: p.summary.uncorrectedErrors,
      consistency: p.summary.consistency,
      wpmTimeline: p.summary.timeline,
    });

    await mergeStats(tx, keyStatistics, keyStatistics.char, "char", userId, p.layoutId, p.summary.keys);
    await mergeStats(tx, bigramStatistics, bigramStatistics.bigram, "bigram", userId, p.layoutId, p.summary.bigrams);

    // Learning profile (row is created at signup; lock it for the update).
    const [current] = await tx
      .select()
      .from(learningProfiles)
      .where(eq(learningProfiles.userId, userId))
      .for("update");

    const next = updateProfile(
      {
        currentWpm: current?.currentWpm ?? null,
        currentAccuracy: current?.currentAccuracy ?? null,
        streakDays: current?.streakDays ?? 0,
        lastPracticeAt: current?.lastPracticeAt ?? null,
        skillLevel: current?.skillLevel ?? null,
        targetWpm: current?.targetWpm ?? null,
        assessedAt: current?.assessedAt ?? null,
      },
      {
        mode: p.mode,
        netWpm: numbers.netWpm,
        accuracy: numbers.accuracy,
        keystrokes: p.summary.keystrokes,
        endedAt: new Date(p.endedAt),
        timeZone: p.timeZone,
      },
    );

    const keyRows = await tx
      .select({ key: keyStatistics.char, attempts: keyStatistics.attempts, ewmaErrorRate: keyStatistics.ewmaErrorRate })
      .from(keyStatistics)
      .where(and(eq(keyStatistics.userId, userId), eq(keyStatistics.layoutId, p.layoutId)));
    const bigramRows = await tx
      .select({ key: bigramStatistics.bigram, attempts: bigramStatistics.attempts, ewmaErrorRate: bigramStatistics.ewmaErrorRate })
      .from(bigramStatistics)
      .where(and(eq(bigramStatistics.userId, userId), eq(bigramStatistics.layoutId, p.layoutId)));

    // Trends over the last comparable sessions (same rules as the speed profile).
    const history = await tx
      .select({ wpm: sessionStatistics.netWpm, accuracy: sessionStatistics.accuracy })
      .from(sessionStatistics)
      .innerJoin(typingSessions, eq(typingSessions.id, sessionStatistics.sessionId))
      .where(
        and(
          eq(typingSessions.userId, userId),
          inArray(typingSessions.mode, LEARNING_CONFIG.profileModes),
          gte(sessionStatistics.keystrokes, LEARNING_CONFIG.minKeystrokesForProfile),
        ),
      )
      .orderBy(desc(typingSessions.endedAt))
      .limit(TREND_CONFIG.window * 2);
    const chronological = history.reverse();

    const values = {
      ...next,
      weakKeys: pickWeak(keyRows, LEARNING_CONFIG.weakKey),
      weakBigrams: pickWeak(bigramRows, LEARNING_CONFIG.weakBigram),
      wpmTrend: computeTrend(chronological.map((h) => h.wpm), TREND_CONFIG.wpmThreshold),
      accuracyTrend: computeTrend(chronological.map((h) => h.accuracy), TREND_CONFIG.accuracyThreshold),
    };
    if (current) {
      await tx.update(learningProfiles).set(values).where(eq(learningProfiles.userId, userId));
    } else {
      await tx.insert(learningProfiles).values({ userId, ...values });
    }

    return {
      sessionId: inserted.id,
      duplicate: false,
      ...numbers,
      skillLevel: next.skillLevel,
      assessmentReliable:
        p.mode === "assessment" ? isReliableAssessment(p.summary.keystrokes, numbers.accuracy) : null,
    };
  });
}

type StatsTable = typeof keyStatistics | typeof bigramStatistics;

async function mergeStats(
  tx: Tx,
  table: StatsTable,
  keyColumn: typeof keyStatistics.char | typeof bigramStatistics.bigram,
  keyField: "char" | "bigram",
  userId: string,
  layoutId: string,
  session: Record<string, KeyStat>,
) {
  const entries = Object.entries(session).filter(([, s]) => s.attempts > 0);
  if (!entries.length) return;
  const keys = entries.map(([k]) => k);

  const existingRows = await tx
    .select({
      key: keyColumn,
      attempts: table.attempts,
      errors: table.errors,
      ewmaErrorRate: table.ewmaErrorRate,
      ewmaLatencyMs: table.ewmaLatencyMs,
    })
    .from(table)
    .where(and(eq(table.userId, userId), eq(table.layoutId, layoutId), inArray(keyColumn, keys)))
    .for("update");
  const existing = new Map<string, StoredKeyStat>(existingRows.map((r) => [r.key, r]));

  const now = new Date();
  const rows = entries.map(([key, stat]) => ({
    userId,
    layoutId,
    [keyField]: key,
    ...mergeKeyStat(existing.get(key), stat),
    lastSeenAt: now,
  }));

  await tx
    .insert(table)
    .values(rows as (typeof table.$inferInsert)[])
    .onConflictDoUpdate({
      target: [table.userId, table.layoutId, keyColumn],
      set: {
        attempts: sql`excluded.attempts`,
        errors: sql`excluded.errors`,
        ewmaErrorRate: sql`excluded.ewma_error_rate`,
        ewmaLatencyMs: sql`excluded.ewma_latency_ms`,
        lastSeenAt: sql`excluded.last_seen_at`,
      },
    });
}
