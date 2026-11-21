import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { getClaims, isGuest } from "@/features/auth/dal";

/** Reminds guests that their progress only lives in this browser until they create an account. */
export async function GuestBanner({ locale, t }: { locale: Locale; t: Dictionary["guest"] }) {
  const claims = await getClaims();
  if (!claims || !isGuest(claims)) return null;
  return (
    <div className="border-b border-border bg-accent-soft">
      <p className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm sm:px-6">
        <span>{t.banner}</span>
        <Link href={`/${locale}/register`} className="font-medium underline">
          {t.save}
        </Link>
      </p>
    </div>
  );
}
