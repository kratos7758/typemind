import "server-only";
import { redirect } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { requireClaims } from "@/features/auth/dal";
import { getUserContext } from "./queries";

/** Signed-in user who finished onboarding; otherwise redirects to login or onboarding. */
export async function requireOnboardedUser(locale: Locale) {
  const claims = await requireClaims(locale);
  const user = await getUserContext(claims);
  if (!user.onboardingCompleted) redirect(`/${locale}/onboarding`);
  return { claims, user };
}
