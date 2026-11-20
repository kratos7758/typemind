import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { buttonVariants } from "@/components/ui/button";

export default async function NotFound() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-start gap-4 px-4 py-24 sm:px-6">
      <p className="font-mono text-sm text-fg-muted">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">{dict.common.notFound}</h1>
      <Link href={`/${locale}`} className={buttonVariants({ variant: "secondary" })}>
        {dict.common.home}
      </Link>
    </main>
  );
}
