import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { GuestBanner } from "@/features/auth/components/guest-banner";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { AppNav } from "@/components/layout/app-nav";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/features/auth/actions";
import { PendingSessions } from "@/features/sessions/components/pending-sessions";

export default async function AppLayout({ children }: LayoutProps<"/[locale]/app">) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        {/* Mobile: logo + account actions on one line, navigation scrolls horizontally below.
            Desktop (lg): everything on a single line. */}
        <div className="mx-auto grid w-full max-w-5xl grid-cols-[auto_1fr] items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6 lg:grid-cols-[auto_1fr_auto]">
          <Logo href={`/${locale}/app`} />
          <div className="col-span-2 row-start-2 -mx-4 overflow-x-auto px-4 [scrollbar-width:none] lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:mx-0 lg:px-0">
            <AppNav
              items={[
                { href: `/${locale}/app`, label: dict.app.nav.dashboard, exact: true },
                { href: `/${locale}/app/practice`, label: dict.app.nav.practice },
                { href: `/${locale}/app/analytics`, label: dict.app.nav.analytics },
                { href: `/${locale}/app/billing`, label: dict.app.nav.billing },
                { href: `/${locale}/app/settings`, label: dict.app.nav.settings },
              ]}
            />
          </div>
          <div className="flex items-center justify-end gap-3 lg:col-start-3">
            <LanguageSwitch locale={locale} label={dict.nav.language} />
            <form action={logoutAction}>
              <input type="hidden" name="locale" value={locale} />
              <Button type="submit" variant="ghost" size="sm">
                {dict.nav.logout}
              </Button>
            </form>
          </div>
        </div>
      </header>
      <Suspense fallback={null}>
        <GuestBanner locale={locale} t={dict.guest} />
      </Suspense>
      <PendingSessions label={dict.app.pending} />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}
