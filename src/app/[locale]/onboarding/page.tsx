import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/features/auth/actions";
import { requireClaims } from "@/features/auth/dal";
import { getUserContext } from "@/features/account/queries";
import { OnboardingWizard } from "@/features/onboarding/components/onboarding-wizard";
import type { Locale } from "@/i18n/config";

export default async function OnboardingPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo href={`/${locale}/app`} />
        <div className="flex items-center gap-3">
          <LanguageSwitch locale={locale} label={dict.nav.language} />
          <form action={logoutAction}>
            <input type="hidden" name="locale" value={locale} />
            <Button type="submit" variant="ghost" size="sm">
              {dict.nav.logout}
            </Button>
          </form>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-16 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">{dict.onboarding.title}</h1>
        <p className="mt-1 mb-8 text-fg-muted">{dict.onboarding.subtitle}</p>
        <Suspense fallback={<p className="text-fg-muted">{dict.common.loading}</p>}>
          <Wizard locale={locale} dict={dict} />
        </Suspense>
      </main>
    </div>
  );
}

async function Wizard({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const user = await getUserContext(await requireClaims(locale));
  return (
    <OnboardingWizard
      locale={locale}
      t={{ onboarding: dict.onboarding, topics: dict.topics, layouts: dict.layouts }}
      initial={{
        contentLanguage: user.contentLanguage,
        layoutId: user.layoutId,
        experience: user.experience,
        goals: user.goals,
        interests: user.interests,
        dailyGoalMinutes: user.dailyGoalMinutes,
      }}
    />
  );
}
