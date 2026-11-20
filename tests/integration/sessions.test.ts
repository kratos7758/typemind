/**
 * Session persistence against the local database: idempotency, server-side
 * recomputation, per-key aggregation and learning-profile updates.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { and, eq } from "drizzle-orm";
import { adminDb } from "@/lib/db/client";
import { keyStatistics, learningProfiles, sessionStatistics, typingSessions } from "@/lib/db/schema";
import { recordSession } from "@/features/sessions/record";
import { sessionPayloadSchema, type SessionPayload } from "@/features/sessions/schema";
import { TypingEngine } from "@/features/typing-engine/engine";
import { summarize } from "@/features/typing-engine/stats";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
let userId: string;

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email: `sessions-${crypto.randomUUID()}@example.test`,
    password: "integration-test-password",
    email_confirm: true,
  });
  if (error) throw error;
  userId = data.user!.id;
});

afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId);
});

/** Builds a realistic payload by actually running the engine. */
function payload(text: string, typed: string, msPerChar: number, overrides: Partial<SessionPayload> = {}): SessionPayload {
  let now = 0;
  const engine = new TypingEngine(text, { now: () => now });
  for (const ch of Array.from(typed)) {
    if (ch === "⌫") engine.deleteBackward();
    else engine.insert(ch);
    now += msPerChar;
  }
  engine.finish();
  const summary = summarize(engine.result());
  const ended = new Date();
  return sessionPayloadSchema.parse({
    clientSessionId: crypto.randomUUID(),
    mode: "speed_test",
    exerciseKey: "speed:60",
    layoutId: "fr-azerty",
    timeZone: "America/Toronto",
    startedAt: new Date(ended.getTime() - summary.durationMs - 1000).toISOString(),
    endedAt: ended.toISOString(),
    completed: summary.completed,
    summary,
    ...overrides,
  });
}

const sentence = "le chat dort sur le tapis rouge pendant que la pluie tombe sur le toit de la maison";

describe("recordSession", () => {
  it("stores the session with server-computed numbers", async () => {
    const p = payload(sentence, sentence, 200);
    const result = await recordSession(userId, p);
    expect(result.duplicate).toBe(false);
    // Timing runs from the first to the last keystroke: n chars over (n − 1) intervals of 200 ms.
    const n = Array.from(sentence).length;
    expect(result.netWpm).toBeCloseTo(n / 5 / (((n - 1) * 200) / 60_000), 1);
    expect(result.accuracy).toBe(100);

    const [stats] = await adminDb().select().from(sessionStatistics).where(eq(sessionStatistics.sessionId, result.sessionId));
    expect(stats.correctChars).toBe(Array.from(sentence).length);
  });

  it("is idempotent on clientSessionId (offline retries)", async () => {
    const p = payload(sentence, sentence, 250);
    const first = await recordSession(userId, p);
    const second = await recordSession(userId, p);
    expect(second.duplicate).toBe(true);
    expect(second.sessionId).toBe(first.sessionId);
    const rows = await adminDb()
      .select()
      .from(typingSessions)
      .where(and(eq(typingSessions.userId, userId), eq(typingSessions.clientSessionId, p.clientSessionId)));
    expect(rows).toHaveLength(1);
  });

  it("aggregates per-key statistics across sessions", async () => {
    const [before] = await adminDb()
      .select()
      .from(keyStatistics)
      .where(and(eq(keyStatistics.userId, userId), eq(keyStatistics.char, "t")));
    // Types "x" instead of the first "t", corrects it.
    const typed = sentence.replace("t", "x⌫t");
    await recordSession(userId, payload(sentence, typed, 200));
    const [after] = await adminDb()
      .select()
      .from(keyStatistics)
      .where(and(eq(keyStatistics.userId, userId), eq(keyStatistics.char, "t")));
    const tCount = Array.from(sentence).filter((c) => c === "t").length;
    expect(after.attempts - (before?.attempts ?? 0)).toBe(tCount);
    expect(after.errors - (before?.errors ?? 0)).toBe(1);
    expect(after.ewmaErrorRate).toBeGreaterThan(before?.ewmaErrorRate ?? 0);
  });

  it("a reliable assessment sets the skill level", async () => {
    const long = `${sentence} ${sentence}`;
    const result = await recordSession(userId, payload(long, long, 300, { mode: "assessment", exerciseKey: "assessment:fr" }));
    expect(result.assessmentReliable).toBe(true);
    expect(result.skillLevel).toBe("intermediate"); // ≈ 40 WPM at 100%
    const [profile] = await adminDb().select().from(learningProfiles).where(eq(learningProfiles.userId, userId));
    expect(profile.currentWpm).toBe(result.netWpm);
    expect(profile.targetWpm).toBe(55);
    expect(profile.streakDays).toBe(1);
    expect(profile.assessedAt).not.toBeNull();
  });
});

describe("payload validation", () => {
  it("rejects impossible speeds and inconsistent counts", () => {
    const p = payload(sentence, sentence, 200);
    const tooFast = { ...p, summary: { ...p.summary, durationMs: 1000 } };
    expect(sessionPayloadSchema.safeParse(tooFast).success).toBe(false);
    const forged = { ...p, summary: { ...p.summary, correctChars: p.summary.keystrokes + 50 } };
    expect(sessionPayloadSchema.safeParse(forged).success).toBe(false);
    const badKey = { ...p, exerciseKey: "javascript:alert(1)" };
    expect(sessionPayloadSchema.safeParse(badKey).success).toBe(false);
  });
});
