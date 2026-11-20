"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/config";

const className = "text-sm text-fg-muted hover:text-fg";

function CurrentPageSwitch({ target, label }: { target: Locale; label: string }) {
  const pathname = usePathname();
  const href = pathname.replace(/^\/(fr|en)(?=\/|$)/, `/${target}`);
  return (
    <Link href={href} hrefLang={target} className={className}>
      {label}
    </Link>
  );
}

/**
 * Switches /fr/... ⇄ /en/... while keeping the current page.
 * The path is request-time data: until it streams in, the link points to the home page.
 */
export function LanguageSwitch({ locale, label }: { locale: Locale; label: string }) {
  const target: Locale = locale === "fr" ? "en" : "fr";
  return (
    <Suspense
      fallback={
        <Link href={`/${target}`} hrefLang={target} className={className}>
          {label}
        </Link>
      }
    >
      <CurrentPageSwitch target={target} label={label} />
    </Suspense>
  );
}
