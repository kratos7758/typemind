import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { locales } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { SiteFooter } from "@/components/layout/site-footer";
import "../globals.css";

const ui = Instrument_Sans({ variable: "--font-ui", subsets: ["latin", "latin-ext"] });
const typing = JetBrains_Mono({ variable: "--font-typing", subsets: ["latin", "latin-ext"] });

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.meta.title, description: dict.meta.description };
}

export default async function RootLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return (
    <html lang={locale} className={`${ui.variable} ${typing.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-fg focus:shadow-md"
        >
          {dict.nav.skip}
        </a>
        {children}
        <SiteFooter locale={locale} dict={dict} />
      </body>
    </html>
  );
}
