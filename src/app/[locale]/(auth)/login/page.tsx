import Link from "next/link";
import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { LoginForm } from "@/features/auth/components/auth-forms";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

export default async function LoginPage({ searchParams }: PageProps<"/[locale]/login">) {
  const locale = await getLocale();
  const t = (await getDictionary(locale)).auth;
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{t.login.title}</h1>
      {/*
        searchParams are request-time data: stream the form behind a boundary.
        The fallback must NOT contain inputs: the streamed form replaces it and
        would wipe anything typed in the meantime.
      */}
      <Suspense fallback={<FormSkeleton />}>
        <LoginWithParams locale={locale} t={t} searchParams={searchParams} />
      </Suspense>
      <p className="mt-8 text-sm text-fg-muted">
        {t.login.noAccount}{" "}
        <Link href={`/${locale}/register`} className="font-medium text-accent hover:underline">
          {t.login.register}
        </Link>
      </p>
    </>
  );
}

function FormSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div className="h-4 w-28 rounded bg-surface-2" />
          <div className="h-10 rounded-md bg-surface-2" />
        </div>
      ))}
      <div className="mt-2 h-10 rounded-md bg-surface-2" />
    </div>
  );
}

async function LoginWithParams({
  locale,
  t,
  searchParams,
}: {
  locale: Locale;
  t: Dictionary["auth"];
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  return <LoginForm locale={locale} t={t} next={next} linkError={params.error === "linkInvalid"} />;
}
