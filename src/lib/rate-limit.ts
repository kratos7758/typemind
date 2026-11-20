import "server-only";
import { sql } from "drizzle-orm";
import { adminDb } from "@/lib/db/client";
import { rateLimits } from "@/lib/db/schema";

/**
 * Fixed-window rate limiting backed by Postgres (ADR-024): one atomic upsert per call,
 * correct across any number of server instances, no extra service to run.
 */
export type RateLimitRule = { name: string; limit: number; windowSeconds: number };

export const RATE_LIMITS = {
  sessions: { name: "sessions", limit: 30, windowSeconds: 60 },
  aiExercise: { name: "ai-exercise", limit: 6, windowSeconds: 60 },
  accountExport: { name: "account-export", limit: 5, windowSeconds: 3600 },
  billing: { name: "billing", limit: 10, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

/** Start of the window containing `now` (aligned on multiples of the window length). */
export function windowStart(now: Date, windowSeconds: number): Date {
  const ms = windowSeconds * 1000;
  return new Date(Math.floor(now.getTime() / ms) * ms);
}

export async function rateLimit(rule: RateLimitRule, subject: string, now: Date = new Date()): Promise<RateLimitResult> {
  const start = windowStart(now, rule.windowSeconds);
  const key = `${rule.name}:${subject}`;
  const [row] = await adminDb()
    .insert(rateLimits)
    .values({ key, windowStart: start, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });

  // Housekeeping, ~1% of calls: drop windows older than a day.
  if (Math.random() < 0.01) {
    void adminDb()
      .delete(rateLimits)
      .where(sql`${rateLimits.windowStart} < now() - interval '1 day'`)
      .catch(() => undefined);
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((start.getTime() + rule.windowSeconds * 1000 - now.getTime()) / 1000));
  return { allowed: row.count <= rule.limit, remaining: Math.max(0, rule.limit - row.count), retryAfterSeconds };
}

/** Standard 429 response with Retry-After. */
export function tooManyRequests(result: RateLimitResult) {
  return Response.json(
    { error: "rate_limited", retryAfterSeconds: result.retryAfterSeconds },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
  );
}
