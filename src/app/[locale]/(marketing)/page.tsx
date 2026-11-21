import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { GuestStartForm } from "@/features/auth/components/auth-forms";

export default async function HomePage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.home;

  return (
    <>
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo href={`/${locale}`} />
        <nav className="flex items-center gap-4">
          <LanguageSwitch locale={locale} label={dict.nav.language} />
          <Link href={`/${locale}/pricing`} className="text-sm text-fg-muted hover:text-fg">
            {dict.nav.pricing}
          </Link>
          <Link href={`/${locale}/login`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            {dict.nav.login}
          </Link>
        </nav>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 sm:px-6">
        <section className="py-16 sm:py-24">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            {t.headline}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-fg-muted text-pretty">{t.subhead}</p>
          <div className="mt-8 flex flex-col gap-4">
            <GuestStartForm
              locale={locale}
              t={dict.auth}
              label={t.cta}
              notice={
                <p className="max-w-xl text-xs text-fg-muted">
                  {t.guestNotice}{" "}
                  <Link href={`/${locale}/terms`} className="underline">
                    {dict.nav.terms}
                  </Link>{" "}
                  ·{" "}
                  <Link href={`/${locale}/privacy`} className="underline">
                    {dict.nav.privacy}
                  </Link>
                </p>
              }
            />
            <p className="text-sm text-fg-muted">
              <Link href={`/${locale}/register`} className="font-medium text-accent hover:underline">
                {t.createAccount}
              </Link>
              {" · "}
              <Link href={`/${locale}/login`} className="hover:text-fg">
                {t.secondary}
              </Link>
            </p>
          </div>
        </section>

        <section className="grid gap-x-10 gap-y-8 border-t border-border py-12 sm:grid-cols-3">
          {t.points.map((point) => (
            <div key={point.title}>
              <h2 className="font-semibold">{point.title}</h2>
              <p className="mt-2 text-fg-muted">{point.body}</p>
            </div>
          ))}
        </section>

        <p className="pb-12 font-mono text-sm text-fg-muted">{t.keyboards}</p>
      </main>
    </>
  );
}
