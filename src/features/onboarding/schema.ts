import { z } from "zod";
import { locales } from "@/i18n/config";
import { LAYOUTS, type LayoutId } from "@/features/typing-engine/layouts";
import { TOPICS } from "@/content/topics";

export const GOALS = ["speed", "accuracy", "work", "studies", "programming", "touch"] as const;
export const EXPERIENCE = ["never", "beginner", "intermediate", "advanced"] as const;
export const DAILY_MINUTES = [5, 10, 15, 20, 30] as const;

const isTimeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const onboardingSchema = z.object({
  locale: z.enum(locales),
  contentLanguage: z.enum(locales),
  layoutId: z.enum(Object.keys(LAYOUTS) as [LayoutId, ...LayoutId[]]),
  experience: z.enum(EXPERIENCE),
  goals: z.array(z.enum(GOALS)).max(GOALS.length),
  interests: z.array(z.enum(TOPICS)).min(1).max(TOPICS.length),
  dailyGoalMinutes: z.number().int().refine((n) => (DAILY_MINUTES as readonly number[]).includes(n)),
  timeZone: z.string().max(64).refine(isTimeZone).optional(),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
