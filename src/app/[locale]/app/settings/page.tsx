import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { requireOnboardedUser } from "@/features/account/guards";
import { SettingsForm } from "@/features/settings/components/settings-form";
import { AccountData } from "@/features/account/components/account-data";

export default async function SettingsPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">{dict.settings.title}</h1>
      <Suspense fallback={<p className="text-fg-muted">{dict.common.loading}</p>}>
        <Settings locale={locale} dict={dict} />
      </Suspense>
    </div>
  );
}

async function Settings({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const { claims, user } = await requireOnboardedUser(locale);
  return (
    <>
    <SettingsForm
      locale={locale}
      t={{ settings: dict.settings, onboarding: dict.onboarding, topics: dict.topics, layouts: dict.layouts }}
      initial={{
        contentLanguage: user.contentLanguage,
        layoutId: user.layoutId,
        interests: user.interests,
        dailyGoalMinutes: user.dailyGoalMinutes,
        showVirtualKeyboard: user.showVirtualKeyboard,
        targetWpm: user.learning?.targetWpm ?? null,
      }}
    />
    <AccountData locale={locale} email={typeof claims.email === "string" ? claims.email : ""} t={dict.account} />
    </>
  );
}
