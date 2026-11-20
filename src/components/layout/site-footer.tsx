import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";

export function SiteFooter({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-fg-muted sm:px-6">
        <p>
          {dict.footer.rights} · {dict.footer.madeIn}
        </p>
        <nav className="flex flex-wrap gap-4" aria-label={dict.footer.rights}>
          <Link href={`/${locale}/pricing`} className="hover:text-fg">
            {dict.nav.pricing}
          </Link>
          <Link href={`/${locale}/privacy`} className="hover:text-fg">
            {dict.nav.privacy}
          </Link>
          <Link href={`/${locale}/terms`} className="hover:text-fg">
            {dict.nav.terms}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
