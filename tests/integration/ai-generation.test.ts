/**
 * AI generation against the real local database and a local HTTP server that speaks
 * the OpenAI-compatible protocol. No real AI provider is involved: this verifies OUR code
 * (quota, validation, persistence, logging, refunds), not a model's output.
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { and, eq } from "drizzle-orm";
import { adminDb } from "@/lib/db/client";
import { aiGenerations, exercises, usageQuotas } from "@/lib/db/schema";
import { openAICompatibleProvider } from "@/lib/ai/provider";
import { generateExercise } from "@/features/ai/generate";
import { periodStart } from "@/features/billing/quota";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});

const GOOD = JSON.stringify({
  title: "Les séismes",
  text:
    "Les tremblements de terre se produisent lorsque les plaques de la croûte terrestre se déplacent brusquement. " +
    "Les sismologues mesurent leur force et tentent de prévoir les zones à risque. Grâce à des capteurs très précis, " +
    "ils détectent des vibrations invisibles et transmettent des alertes en quelques secondes pour protéger la population.",
  objective: "Travailler les lettres r et t.",
  explanation: "Ce texte contient beaucoup de « tr ».",
});

/** What the fake provider answers next: "good" | "bad" (invalid JSON content) | "error" (HTTP 500). */
let mode: "good" | "bad" | "error" = "good";
let calls = 0;
let server: Server;
let baseUrl: string;
let userId: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    calls++;
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (mode === "error") {
        res.writeHead(500).end("{}");
        return;
      }
      const content = mode === "good" ? GOOD : '{"title": "x"}';
      res
        .writeHead(200, { "Content-Type": "application/json" })
        .end(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 120, completion_tokens: 180 } }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;

  const { data, error } = await admin.auth.admin.createUser({
    email: `ai-${crypto.randomUUID()}@example.test`,
    password: "integration-test-password",
    email_confirm: true,
    user_metadata: { locale: "fr" },
  });
  if (error) throw error;
  userId = data.user!.id;
});

afterAll(async () => {
  server?.close();
  if (userId) await admin.auth.admin.deleteUser(userId);
});

beforeEach(async () => {
  mode = "good";
  calls = 0;
  await adminDb().delete(usageQuotas).where(eq(usageQuotas.userId, userId));
});

const provider = () => openAICompatibleProvider({ baseUrl, apiKey: "test", model: "fake-model" });

async function quotaUsed() {
  const [row] = await adminDb()
    .select()
    .from(usageQuotas)
    .where(and(eq(usageQuotas.userId, userId), eq(usageQuotas.periodStart, periodStart())));
  return row?.used ?? 0;
}

describe("generateExercise", () => {
  it("returns unavailable when no provider is configured", async () => {
    expect(await generateExercise(userId, "science", null)).toEqual({ status: "unavailable" });
    expect(await quotaUsed()).toBe(0);
  });

  it("stores a private exercise, logs usage and consumes one unit", async () => {
    const r = await generateExercise(userId, "science", provider());
    expect(r).toMatchObject({ status: "ok", remaining: 2 }); // Free plan: 3 per month
    if (r.status !== "ok") return;

    const [ex] = await adminDb().select().from(exercises).where(eq(exercises.id, r.exerciseId));
    expect(ex).toMatchObject({ kind: "ai", ownerId: userId, language: "fr", topicKey: "science", title: "Les séismes" });
    expect(ex.targetChars).toEqual([]); // new user: no weak keys yet

    const logs = await adminDb().select().from(aiGenerations).where(eq(aiGenerations.exerciseId, r.exerciseId));
    expect(logs[0]).toMatchObject({ status: "succeeded", model: "fake-model", inputTokens: 120, outputTokens: 180 });
    expect(await quotaUsed()).toBe(1);
  });

  it("retries once on invalid output, then refunds the quota", async () => {
    mode = "bad";
    const r = await generateExercise(userId, "science", provider());
    expect(r).toEqual({ status: "failed", reason: "invalid_schema" });
    expect(calls).toBe(2);
    expect(await quotaUsed()).toBe(0);
  });

  it("refunds the quota when the provider is down", async () => {
    mode = "error";
    const r = await generateExercise(userId, "science", provider());
    expect(r).toEqual({ status: "failed", reason: "http_5xx" });
    expect(await quotaUsed()).toBe(0);
  });

  it("never exceeds the monthly quota, even with concurrent requests", async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => generateExercise(userId, "space", provider())));
    expect(results.filter((r) => r.status === "ok")).toHaveLength(3);
    expect(results.filter((r) => r.status === "quota_exceeded")).toHaveLength(3);
    expect(await quotaUsed()).toBe(3);
  });
});
