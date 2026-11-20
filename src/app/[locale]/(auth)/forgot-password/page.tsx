import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { ForgotPasswordForm } from "@/features/auth/components/auth-forms";

export default async function ForgotPasswordPage() {
  const locale = await getLocale();
  const t = (await getDictionary(locale)).auth;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t.forgot.title}</h1>
      <p className="mt-1 mb-6 text-fg-muted">{t.forgot.subtitle}</p>
      <ForgotPasswordForm locale={locale} t={t} />
      <Link href={`/${locale}/login`} className="mt-8 inline-block text-sm text-fg-muted hover:text-fg">
        {t.forgot.back}
      </Link>
    </>
  );
}
