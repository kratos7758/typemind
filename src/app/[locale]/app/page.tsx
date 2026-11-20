import Link from "next/link";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { requireOnboardedUser } from "@/features/account/guards";
import {
  getPassedLessons,
  getPracticeMsToday,
  getRecentExerciseKeys,
  getRecentSessions,
} from "@/features/account/queries";
import { recommend } from "@/features/learning/recommend";
import { lessonsFor } from "@/content/lessons";
import { buttonVariants } from "@/components/ui/button";
import { format } from "@/lib/utils";
import { formatPercent } from "@/lib/format";
import { planLabel } from "@/features/billing/plans";

export default async function DashboardPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return (
    <Suspense fallback={<p className="text-fg-muted">{dict.app.loading}</p>}>
      <Dashboard locale={locale} dict={dict} />
    </Suspense>
  );
}

function Metric({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-fg-muted">{label}</dt>
      <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums">{value}</dd>
      {sub ? <dd className="text-xs text-fg-muted">{sub}</dd> : null}
    </div>
  );
}

async function Dashboard({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const t = dict.app;
  const { claims, user } = await requireOnboardedUser(locale);
  const [recent, todayMs, passed, recentKeys] = await Promise.all([
    getRecentSessions(claims),
    getPracticeMsToday(claims, user.timeZone),
    getPassedLessons(claims),
    getRecentExerciseKeys(claims),
  ]);
  const lp = user.learning;
  const lessons = lessonsFor(user.layoutId);

  const next = recommend({
    skillLevel: lp?.skillLevel ?? null,
    experience: user.experience,
    lessons,
    passedLessons: passed,
    contentLanguage: user.contentLanguage,
    interests: user.interests,
    recentExerciseKeys: recentKeys,
    currentAccuracy: lp?.currentAccuracy ?? null,
    weakKeys: lp?.weakKeys ?? [],
    weakBigrams: lp?.weakBigrams ?? [],
    wpmTrend: lp?.wpmTrend ?? "unknown",
  });
  const base = `/${locale}/app/practice`;
  let nextHref: string;
  let nextLabel: string;
  switch (next.kind) {
    case "assessment":
      nextHref = `${base}/assessment/${user.contentLanguage}`;
      nextLabel = t.next.assessment;
      break;
    case "lesson":
      nextHref = `${base}/lesson/${next.id}`;
      nextLabel = format(t.next.lesson, { lesson: dict.lessons[next.id as keyof Dictionary["lessons"]] });
      break;
    case "accuracy":
      nextHref = `${base}/accuracy/${next.id}`;
      nextLabel = format(t.next.accuracy, { title: next.title });
      break;
    case "adaptive":
      nextHref = `${base}/adaptive/weak`;
      nextLabel = t.next.adaptive;
      break;
    case "text":
      nextHref = `${base}/text/${next.id}`;
      nextLabel = format(t.next.text, { title: next.title });
      break;
  }
  // The "why", built only from measured data (never invented).
  const reason = next.reason;
  const reasonText =
    reason.code === "low_accuracy"
      ? format(t.reasons.low_accuracy, { accuracy: reason.accuracy })
      : reason.code === "weak_keys"
        ? format(t.reasons.weak_keys, { keys: reason.keys.map((k) => (k === " " ? "␣" : k)).join(", ") })
        : t.reasons[reason.code];

  // An assessment was taken but did not produce a level → suggest a retake.
  const assessmentTaken = recentKeys.some((k) => k.startsWith("assessment:"));
  const none = t.metrics.none;
  const todayMinutes = Math.round(todayMs / 60_000);
  const modeLabel = (mode: string) => t.modes[mode as keyof typeof t.modes] ?? mode;
  const dateFmt = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: user.timeZone ?? undefined,
  });

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {user.displayName ? format(t.welcome, { name: user.displayName }) : t.welcomeAnonymous}
          </h1>
          <p className="mt-1 text-sm text-fg-muted">{format(t.plan, {
              plan: planLabel(user.planId, {
                free: dict.pricing.free.name,
                pro: dict.pricing.pro.name,
                monthly: dict.pricing.monthly,
                yearly: dict.pricing.yearly,
              }),
            })}</p>
        </div>
      </div>

      <section className="flex flex-col gap-4 rounded-md border border-border bg-surface p-6">
        <div>
          <p className="font-medium text-fg">{nextLabel}</p>
          {/* The assessment label already explains itself; other kinds get their data-based reason. */}
          {next.kind !== "assessment" || assessmentTaken ? (
            <p className="mt-1 max-w-2xl text-sm text-fg-muted" data-testid="recommendation-reason">
              {!lp?.skillLevel && assessmentTaken ? t.next.retake : reasonText}
            </p>
          ) : null}
        </div>
        <div>
          <Link href={nextHref} className={buttonVariants({ size: "lg" })}>
            {t.start}
          </Link>
        </div>
      </section>

      <dl className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-5">
        <Metric label={t.metrics.level} value={lp?.skillLevel ? t.levels[lp.skillLevel] : none} />
        <Metric
          label={t.metrics.wpm}
          value={lp?.currentWpm != null ? Math.round(lp.currentWpm) : none}
          sub={
            lp?.currentWpm != null
              ? `${t.trendLabel} : ${t.trends[lp.wpmTrend]}${lp.targetWpm ? ` · ${t.metrics.target} : ${lp.targetWpm}` : ""}`
              : undefined
          }
        />
        <Metric label={t.metrics.accuracy} value={lp?.currentAccuracy != null ? formatPercent(locale, lp.currentAccuracy, 0) : none} />
        <Metric label={t.metrics.streak} value={format(t.metrics.streakDays, { n: lp?.streakDays ?? 0 })} />
        <Metric
          label={t.metrics.today}
          value={format(t.metrics.todayValue, { done: todayMinutes, goal: user.dailyGoalMinutes })}
        />
      </dl>

      <div className="grid gap-10 sm:grid-cols-2">
        <section>
          <h2 className="font-semibold">{t.weakKeys}</h2>
          {lp?.weakKeys.length ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {lp.weakKeys.map((k) => (
                <li key={k} className="rounded-md border border-border px-3 py-1.5 font-mono text-lg">
                  {k}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-fg-muted">{t.weakKeysEmpty}</p>
          )}
          {lp?.weakBigrams.length ? (
            <>
              <h3 className="mt-6 text-sm font-medium">{t.weakBigrams}</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {lp.weakBigrams.map((b) => (
                  <li key={b} className="rounded-md border border-border px-3 py-1 font-mono">
                    {b}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        <section>
          <h2 className="font-semibold">{t.recent}</h2>
          {recent.length ? (
            <ul className="mt-3 divide-y divide-border">
              {recent.map((s) => (
                <li key={s.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                  <span>
                    <span className="block">{modeLabel(s.mode)}</span>
                    <span className="text-xs text-fg-muted">{dateFmt.format(s.endedAt)}</span>
                  </span>
                  <span className="font-mono tabular-nums">
                    {s.netWpm != null ? `${Math.round(s.netWpm)} ${t.wpmShort}` : none}
                    <span className="ml-3 text-fg-muted">{s.accuracy != null ? formatPercent(locale, s.accuracy, 0) : ""}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-fg-muted">{t.recentEmpty}</p>
          )}
        </section>
      </div>
    </div>
  );
}
