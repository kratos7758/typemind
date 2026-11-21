import Link from "next/link";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import { RegisterForm } from "@/features/auth/components/auth-forms";
import { getClaims, isGuest } from "@/features/auth/dal";

function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 mb-6 text-fg-muted">{subtitle}</p>
    </>
  );
}

/** A guest who registers keeps their progress: say so instead of the generic heading. */
async function RegisterHeading({ dict }: { dict: Dictionary }) {
  const claims = await getClaims();
  return claims && isGuest(claims) ? (
    <Heading title={dict.guest.saveTitle} subtitle={dict.guest.saveSubtitle} />
  ) : (
    <Heading title={dict.auth.register.title} subtitle={dict.auth.register.subtitle} />
  );
}

export default async function RegisterPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.auth;
  return (
    <>
      <Suspense fallback={<Heading title={t.register.title} subtitle={t.register.subtitle} />}>
        <RegisterHeading dict={dict} />
      </Suspense>
      <RegisterForm locale={locale} t={t} legal={{ terms: dict.nav.terms, privacy: dict.nav.privacy }} />
      <p className="mt-8 text-sm text-fg-muted">
        {t.register.hasAccount}{" "}
        <Link href={`/${locale}/login`} className="font-medium text-accent hover:underline">
          {t.register.login}
        </Link>
      </p>
    </>
  );
}
