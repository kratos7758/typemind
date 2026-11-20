"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useParams } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import fr from "@/i18n/messages/fr.json";
import en from "@/i18n/messages/en.json";

/** Route error boundary: localized, no technical details shown to the user. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ locale?: string }>();
  const locale = params.locale === "en" ? "en" : "fr";
  const t = (locale === "en" ? en : fr).errors;

  useEffect(() => {
    // The digest lets us correlate with server logs without exposing details.
    console.error("Route error", error.digest ?? error.message);
  }, [error]);

  return (
    <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-start gap-4 px-4 py-24 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
      <p className="text-fg-muted">{t.body}</p>
      <div className="flex gap-3">
        <Button onClick={reset}>{t.retry}</Button>
        <Link href={`/${locale}`} className={buttonVariants({ variant: "secondary" })}>
          {t.home}
        </Link>
      </div>
    </main>
  );
}
