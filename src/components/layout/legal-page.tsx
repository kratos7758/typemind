import { Logo } from "@/components/brand/logo";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { Alert } from "@/components/ui/field";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { format } from "@/lib/utils";

/** Version date of the legal texts (change it whenever the texts change). */
export const LEGAL_VERSION_DATE = "2026-11-19";

export function LegalPage({
  locale,
  dict,
  content,
}: {
  locale: Locale;
  dict: Dictionary;
  content: { title: string; sections: { h: string; p: string[] }[] };
}) {
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${LEGAL_VERSION_DATE}T00:00:00Z`));
  return (
    <>
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo href={`/${locale}`} />
        <LanguageSwitch locale={locale} label={dict.nav.language} />
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 sm:px-6">
        <h1 className="mt-8 text-3xl font-semibold tracking-tight">{content.title}</h1>
        <p className="mt-2 text-sm text-fg-muted">{format(dict.legal.updated, { date })}</p>
        <div className="mt-6">
          <Alert tone="info">{dict.legal.draft}</Alert>
        </div>
        {content.sections.map((section) => (
          <section key={section.h} className="mt-8">
            <h2 className="text-lg font-semibold">{section.h}</h2>
            {section.p.map((paragraph) => (
              <p key={paragraph} className="mt-2 leading-relaxed text-fg">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </main>
    </>
  );
}
