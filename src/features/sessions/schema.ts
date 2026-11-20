import { z } from "zod";
import { LAYOUTS, type LayoutId } from "@/features/typing-engine/layouts";

export const SESSION_MODES = ["assessment", "lesson", "adaptive", "ai_text", "speed_test", "accuracy"] as const;
export type SessionMode = (typeof SESSION_MODES)[number];

const layoutIds = Object.keys(LAYOUTS) as [LayoutId, ...LayoutId[]];

const MAX_KEYS_PER_SECOND = 25; // ≈ 300 WPM — above any human record
const codePoints = (s: string) => Array.from(s).length;

const keyStat = z.object({
  attempts: z.number().int().min(0).max(100_000),
  errors: z.number().int().min(0).max(100_000),
  totalLatencyMs: z.number().min(0).max(1e9),
  latencySamples: z.number().int().min(0).max(100_000),
});

/**
 * Payload sent by the browser after an exercise. Everything is re-checked on the
 * server and WPM/accuracy are recomputed from raw counts (the client is not trusted).
 */
export const sessionPayloadSchema = z
  .object({
    clientSessionId: z.uuid(),
    mode: z.enum(SESSION_MODES),
    exerciseKey: z.string().regex(/^(lib|lesson|speed|assessment|ai|accuracy|adaptive):[\w:.-]{1,100}$/),
    layoutId: z.enum(layoutIds),
    timeZone: z.string().max(64).optional(),
    startedAt: z.iso.datetime(),
    endedAt: z.iso.datetime(),
    completed: z.boolean(),
    summary: z.object({
      durationMs: z.number().int().min(1000).max(3_600_000),
      keystrokes: z.number().int().min(1).max(100_000),
      correctKeystrokes: z.number().int().min(0),
      correctChars: z.number().int().min(0),
      correctedErrors: z.number().int().min(0),
      uncorrectedErrors: z.number().int().min(0),
      consistency: z.number().min(0).max(100).nullable(),
      keys: z.record(z.string().refine((k) => codePoints(k) === 1), keyStat).refine((r) => Object.keys(r).length <= 300),
      bigrams: z
        .record(z.string().refine((k) => codePoints(k) === 2), keyStat)
        .refine((r) => Object.keys(r).length <= 2000),
      timeline: z
        .array(z.object({ t: z.number().int().min(1), wpm: z.number().min(0), raw: z.number().min(0), errors: z.number().int().min(0) }))
        .max(3600),
    }),
  })
  .superRefine((p, ctx) => {
    const s = p.summary;
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    if (s.correctKeystrokes > s.keystrokes) issue("correctKeystrokes > keystrokes");
    if (s.correctChars > s.correctKeystrokes) issue("correctChars > correctKeystrokes");
    if (s.keystrokes > (s.durationMs / 1000) * MAX_KEYS_PER_SECOND + 5) issue("implausible typing speed");
    const keyAttempts = Object.values(s.keys).reduce((a, k) => a + k.attempts, 0);
    if (keyAttempts > s.keystrokes) issue("key attempts exceed keystrokes");
    for (const k of [...Object.values(s.keys), ...Object.values(s.bigrams)]) {
      if (k.errors > k.attempts || k.latencySamples > k.attempts) issue("inconsistent key statistics");
    }
    const started = Date.parse(p.startedAt);
    const ended = Date.parse(p.endedAt);
    if (ended < started) issue("endedAt before startedAt");
    if (ended - started + 2000 < s.durationMs) issue("active time exceeds wall-clock time");
    if (ended > Date.now() + 5 * 60_000) issue("endedAt in the future");
    if (started < Date.now() - 30 * 24 * 3600_000) issue("session too old");
  });

export type SessionPayload = z.infer<typeof sessionPayloadSchema>;
