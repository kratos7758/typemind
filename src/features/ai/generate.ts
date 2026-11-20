import "server-only";
import { eq } from "drizzle-orm";
import { adminDb } from "@/lib/db/client";
import { aiGenerations, exercises, learningProfiles, userPreferences } from "@/lib/db/schema";
import { AIError, extractJson, openAICompatibleProvider, type AIProvider } from "@/lib/ai/provider";
import { env } from "@/lib/env";
import { isLayoutId } from "@/features/typing-engine/layouts";
import { getEntitlements } from "@/features/billing/entitlements";
import { consumeQuota, refundQuota } from "@/features/billing/quota";
import type { TopicKey } from "@/content/topics";
import { buildExercisePrompt, isValidationFailure, validateExercise, type ExerciseRequest } from "./exercise";

/** Configured provider, or null when AI is disabled (AI_PROVIDER=none). */
export function configuredProvider(): AIProvider | null {
  const e = env();
  if (e.AI_PROVIDER !== "openai-compatible") return null;
  return openAICompatibleProvider({ baseUrl: e.AI_BASE_URL!, apiKey: e.AI_API_KEY!, model: e.AI_MODEL! });
}

export type GenerateOutcome =
  | { status: "ok"; exerciseId: string; remaining: number }
  | { status: "unavailable" }
  | { status: "quota_exceeded"; limit: number }
  | { status: "failed"; reason: string };

/** Estimated cost in micro-dollars (optional env pricing; free tiers → 0). */
function estimateCost(inputTokens: number | null, outputTokens: number | null): number | null {
  const inPrice = Number(process.env.AI_PRICE_INPUT_PER_MTOK_USD ?? 0);
  const outPrice = Number(process.env.AI_PRICE_OUTPUT_PER_MTOK_USD ?? 0);
  if (inputTokens === null && outputTokens === null) return null;
  return Math.round((inputTokens ?? 0) * inPrice + (outputTokens ?? 0) * outPrice); // per-MTok USD × tokens = µUSD
}

/**
 * Generates a personalized exercise for a user:
 * entitlement check → atomic quota → provider call → validation (one retry) → persist.
 * Any failure refunds the quota and is logged in ai_generations (without the text).
 * `userId` MUST come from a verified session.
 */
export async function generateExercise(
  userId: string,
  topic: TopicKey,
  provider: AIProvider | null = configuredProvider(),
): Promise<GenerateOutcome> {
  if (!provider) return { status: "unavailable" };

  const entitlements = await getEntitlements(userId);
  const quota = await consumeQuota(userId, "ai_generation", entitlements.aiGenerationsPerMonth);
  if (!quota) return { status: "quota_exceeded", limit: entitlements.aiGenerationsPerMonth };

  const db = adminDb();
  const [prefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
  const [profile] = await db.select().from(learningProfiles).where(eq(learningProfiles.userId, userId));
  const request: ExerciseRequest = {
    language: prefs?.contentLanguage ?? "fr",
    layoutId: prefs && isLayoutId(prefs.keyboardLayoutId) ? prefs.keyboardLayoutId : "fr-azerty",
    topic,
    skillLevel: profile?.skillLevel ?? null,
    weakKeys: profile?.weakKeys ?? [],
    weakBigrams: profile?.weakBigrams ?? [],
  };

  const log = (values: Partial<typeof aiGenerations.$inferInsert>) =>
    db.insert(aiGenerations).values({
      userId,
      provider: provider.name,
      model: provider.model,
      purpose: "exercise",
      status: "failed",
      ...values,
    });

  let lastReason = "unknown";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await provider.completeJson(buildExercisePrompt(request));
      const validated = validateExercise(extractJson(result.content), request);
      const cost = estimateCost(result.inputTokens, result.outputTokens);
      if (isValidationFailure(validated)) {
        lastReason = `invalid_${validated.reason}`;
        await log({
          status: "invalid_output",
          errorCode: lastReason,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          costEstimateMicros: cost,
        });
        continue; // one retry with a fresh sample
      }

      const [exercise] = await db
        .insert(exercises)
        .values({
          kind: "ai",
          language: request.language,
          title: validated.title,
          body: validated.text,
          topicKey: topic,
          difficulty: validated.difficulty,
          targetChars: validated.targetChars,
          ownerId: userId,
        })
        .returning({ id: exercises.id });
      await log({
        status: "succeeded",
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costEstimateMicros: cost,
        exerciseId: exercise.id,
      });
      return { status: "ok", exerciseId: exercise.id, remaining: quota.limit - quota.used };
    } catch (error) {
      lastReason = error instanceof AIError ? error.code : "unexpected";
      await log({ status: "failed", errorCode: lastReason });
      if (!(error instanceof AIError) || error.code !== "bad_response") break; // only retry bad outputs
    }
  }

  await refundQuota(userId, "ai_generation");
  return { status: "failed", reason: lastReason };
}
