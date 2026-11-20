"use server";

import { and, eq, notInArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { adminDb, withUserDb } from "@/lib/db/client";
import { learningProfiles, userInterests, userPreferences } from "@/lib/db/schema";
import { getClaims } from "@/features/auth/dal";
import { locales } from "@/i18n/config";
import { LAYOUTS, type LayoutId } from "@/features/typing-engine/layouts";
import { TOPICS } from "@/content/topics";
import { DAILY_MINUTES } from "@/features/onboarding/schema";

const settingsSchema = z.object({
  contentLanguage: z.enum(locales),
  layoutId: z.enum(Object.keys(LAYOUTS) as [LayoutId, ...LayoutId[]]),
  interests: z.array(z.enum(TOPICS)).min(1),
  dailyGoalMinutes: z.coerce.number().int().refine((n) => (DAILY_MINUTES as readonly number[]).includes(n)),
  showVirtualKeyboard: z.boolean(),
  targetWpm: z
    .union([z.literal(""), z.coerce.number().int().min(10).max(200)])
    .transform((v) => (v === "" ? null : v)),
});

export type SettingsState = { status: "idle" | "saved" | "error" };

export async function saveSettingsAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const claims = await getClaims();
  if (!claims) return { status: "error" };

  const parsed = settingsSchema.safeParse({
    contentLanguage: formData.get("contentLanguage"),
    layoutId: formData.get("layoutId"),
    interests: formData.getAll("interests"),
    dailyGoalMinutes: formData.get("dailyGoalMinutes"),
    showVirtualKeyboard: formData.get("showVirtualKeyboard") === "on",
    targetWpm: formData.get("targetWpm") ?? "",
  });
  if (!parsed.success) return { status: "error" };
  const s = parsed.data;

  try {
    await withUserDb(claims, async (tx) => {
      await tx
        .update(userPreferences)
        .set({
          contentLanguage: s.contentLanguage,
          keyboardLayoutId: s.layoutId,
          dailyGoalMinutes: s.dailyGoalMinutes,
          showVirtualKeyboard: s.showVirtualKeyboard,
        })
        .where(eq(userPreferences.userId, claims.sub));
      await tx
        .delete(userInterests)
        .where(and(eq(userInterests.userId, claims.sub), notInArray(userInterests.topicKey, s.interests)));
      await tx
        .insert(userInterests)
        .values(s.interests.map((topicKey) => ({ userId: claims.sub, topicKey })))
        .onConflictDoNothing();
    });
    // The speed goal lives in the server-owned learning profile (ADR-012).
    await adminDb().update(learningProfiles).set({ targetWpm: s.targetWpm }).where(eq(learningProfiles.userId, claims.sub));
  } catch (error) {
    console.error("saveSettings failed", error instanceof Error ? error.message : error);
    return { status: "error" };
  }
  refresh();
  return { status: "saved" };
}
