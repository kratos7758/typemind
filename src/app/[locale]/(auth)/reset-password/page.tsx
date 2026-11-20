import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { ResetPasswordForm } from "@/features/auth/components/auth-forms";

/** Reached from the recovery email via /auth/confirm, which establishes a session. */
export default async function ResetPasswordPage() {
  const locale = await getLocale();
  const t = (await getDictionary(locale)).auth;
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{t.reset.title}</h1>
      <ResetPasswordForm locale={locale} t={t} />
    </>
  );
}
