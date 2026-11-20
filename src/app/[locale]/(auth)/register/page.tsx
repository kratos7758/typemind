import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { RegisterForm } from "@/features/auth/components/auth-forms";

export default async function RegisterPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.auth;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t.register.title}</h1>
      <p className="mt-1 mb-6 text-fg-muted">{t.register.subtitle}</p>
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
