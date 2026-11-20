import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { Check } from "lucide-react";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { buttonVariants } from "@/components/ui/button";
import { formatPrice, getPublicPlans } from "@/features/billing/queries";
import { format } from "@/lib/utils";

export default async function PricingPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.pricing;

  return (
    <>
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo href={`/${locale}`} />
        <nav className="flex items-center gap-4">
          <LanguageSwitch locale={locale} label={dict.nav.language} />
          <Link href={`/${locale}/login`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            {dict.nav.login}
          </Link>
        </nav>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 sm:px-6">
        <section className="py-12">
          <h1 className="text-4xl font-semibold tracking-tight">{t.title}</h1>
          <p className="mt-3 max-w-2xl text-lg text-fg-muted">{t.subtitle}</p>
        </section>

        <div className="grid gap-6 md:grid-cols-2">
          <article className="flex flex-col gap-6 rounded-md border border-border bg-surface p-6">
            <div>
              <h2 className="text-lg font-semibold">{t.free.name}</h2>
              <p className="mt-2 text-3xl font-semibold">{formatPrice(locale, 0, "cad")}</p>
            </div>
            <ul className="flex flex-1 flex-col gap-2 text-sm">
              {t.free.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <Link href={`/${locale}/register`} className={buttonVariants({ variant: "secondary" })}>
              {t.free.cta}
            </Link>
          </article>

          <article className="flex flex-col gap-6 rounded-md border-2 border-accent bg-surface p-6">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{t.pro.name}</h2>
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs">{t.pro.badge}</span>
              </div>
              {/* Prices are read at request time (cached), so builds never need the database. */}
              <Suspense fallback={<p className="mt-2 h-9 w-32 rounded bg-surface-2" aria-hidden />}>
                <ProPrices locale={locale} t={t} />
              </Suspense>
            </div>
            <ul className="flex flex-1 flex-col gap-2 text-sm">
              {t.pro.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <Link href={`/${locale}/app/billing`} className={buttonVariants()}>
              {t.pro.cta}
            </Link>
          </article>
        </div>
        <p className="mt-4 text-sm text-fg-muted">{t.currencyNote}</p>

        <section className="mt-16 border-t border-border pt-10">
          <h2 className="text-xl font-semibold">{t.faqTitle}</h2>
          <dl className="mt-6 grid gap-6 md:grid-cols-3">
            {t.faq.map((item) => (
              <div key={item.q}>
                <dt className="font-medium">{item.q}</dt>
                <dd className="mt-1 text-sm text-fg-muted">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
    </>
  );
}

async function ProPrices({ locale, t }: { locale: string; t: Awaited<ReturnType<typeof getDictionary>>["pricing"] }) {
  await connection();
  const plans = await getPublicPlans();
  const monthly = plans.find((p) => p.id === "pro_monthly");
  const yearly = plans.find((p) => p.id === "pro_yearly");
  return (
    <>
      {monthly ? (
        <p className="mt-2 text-3xl font-semibold">
          {formatPrice(locale, monthly.priceCents, monthly.currency)}
          <span className="text-base font-normal text-fg-muted"> {t.perMonth}</span>
        </p>
      ) : null}
      {yearly ? (
        <p className="mt-1 text-sm text-fg-muted">
          {formatPrice(locale, yearly.priceCents, yearly.currency)} {t.perYear} —{" "}
          {format(t.yearlySaving, { monthly: formatPrice(locale, Math.round(yearly.priceCents / 12), yearly.currency) })}
        </p>
      ) : null}
    </>
  );
}
