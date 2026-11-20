import type { Metadata } from "next";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { LegalPage } from "@/components/layout/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: `${dict.legal.terms.title} — TypeMind` };
}

export default async function TermsPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return <LegalPage locale={locale} dict={dict} content={dict.legal.terms} />;
}
