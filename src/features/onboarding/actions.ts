"use server";

import { eq, notInArray, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { adminDb, withUserDb } from "@/lib/db/client";
import { profiles, userInterests, userPreferences } from "@/lib/db/schema";
import { getClaims } from "@/features/auth/dal";
import { onboardingSchema } from "./schema";

export type OnboardingResult = { ok: false; error: "invalid" | "unauthenticated" | "generic" };

export async function saveOnboardingAction(input: unknown): Promise<OnboardingResult> {
  const claims = await getClaims();
  if (!claims) return { ok: false, error: "unauthenticated" };

  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const data = parsed.data;

  try {
    // User-editable rows: written as the user, under RLS.
    await withUserDb(claims, async (tx) => {
      await tx
        .update(userPreferences)
        .set({
          contentLanguage: data.contentLanguage,
          uiLanguage: data.locale,
          keyboardLayoutId: data.layoutId,
          experienceLevel: data.experience,
          goals: data.goals,
          dailyGoalMinutes: data.dailyGoalMinutes,
          timeZone: data.timeZone ?? null,
        })
        .where(eq(userPreferences.userId, claims.sub));

      await tx
        .delete(userInterests)
        .where(and(eq(userInterests.userId, claims.sub), notInArray(userInterests.topicKey, data.interests)));
      await tx
        .insert(userInterests)
        .values(data.interests.map((topicKey) => ({ userId: claims.sub, topicKey })))
        .onConflictDoNothing();
    });

    // Server-owned field (ADR-012).
    await adminDb()
      .update(profiles)
      .set({ onboardingCompletedAt: new Date() })
      .where(eq(profiles.id, claims.sub));
  } catch (error) {
    console.error("saveOnboarding failed", error instanceof Error ? error.message : error);
    return { ok: false, error: "generic" };
  }

  // Pages prefetched before onboarding (e.g. /app) still hold a redirect to /onboarding:
  // drop the client router cache so they are fetched again.
  refresh();
  redirect(`/${data.locale}/app/practice/assessment/${data.contentLanguage}`);
}
