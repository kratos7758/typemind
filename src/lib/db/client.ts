import "server-only";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };

function connection() {
  // Reuse the pool across hot reloads in development.
  globalForDb.pg ??= postgres(env().DATABASE_URL, { prepare: false, max: 10 });
  return globalForDb.pg;
}

/**
 * Privileged database access (bypasses RLS).
 * Only for trusted server code: webhooks, quota counters, statistics writes, admin.
 * Callers MUST derive any user id from a verified session, never from client input.
 */
export const adminDb = () => drizzle(connection(), { schema });

export type Db = ReturnType<typeof adminDb>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type JwtClaims = { sub: string; role?: string; [key: string]: unknown };

/**
 * Runs queries as the authenticated user so that Postgres RLS policies apply (ADR-004).
 * `claims` must come from `supabase.auth.getClaims()` (verified JWT).
 */
export async function withUserDb<T>(claims: JwtClaims, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return adminDb().transaction(async (tx) => {
    await tx.execute(sql`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`);
    await tx.execute(sql`select set_config('request.jwt.claim.sub', ${claims.sub}, true)`);
    await tx.execute(sql`set local role authenticated`);
    return fn(tx);
  });
}
