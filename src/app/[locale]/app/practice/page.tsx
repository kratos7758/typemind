import Link from "next/link";
import { Suspense } from "react";
import { CheckCircle2 } from "lucide-react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { requireOnboardedUser } from "@/features/account/guards";
import { getPassedLessons } from "@/features/account/queries";
import { lessonsFor } from "@/content/lessons";
import { LIBRARY } from "@/content/library";
import { SPEED_DURATIONS } from "@/features/practice/config";
import { buttonVariants } from "@/components/ui/button";
import { cn, format } from "@/lib/utils";
import { getEntitlements } from "@/features/billing/entitlements";
import { getQuota } from "@/features/billing/quota";
import { configuredProvider } from "@/features/ai/generate";
import { AiExerciseCard } from "@/features/ai/components/ai-exercise-card";
import { TOPICS } from "@/content/topics";

export default async function PracticeHubPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-2xl font-semibold tracking-tight">{dict.practice.title}</h1>
      <Suspense fallback={<p className="text-fg-muted">{dict.common.loading}</p>}>
        <Hub locale={locale} dict={dict} />
      </Suspense>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-border pt-6">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-fg-muted">{hint}</p>
      </div>
      {children}
    </section>
  );
}

async function Hub({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const { claims, user } = await requireOnboardedUser(locale);
  const [passed, entitlements] = await Promise.all([getPassedLessons(claims), getEntitlements(claims.sub)]);
  const quota = await getQuota(claims.sub, "ai_generation", entitlements.aiGenerationsPerMonth);
  const aiAvailable = configuredProvider() !== null;
  const targets = [...(user.learning?.weakKeys ?? []), ...(user.learning?.weakBigrams ?? [])];
  const aiTopics = (user.interests.length ? user.interests : [...TOPICS]).map((key) => ({
    key,
    label: dict.topics[key],
    libraryId: LIBRARY.find((t) => t.language === user.contentLanguage && t.topic === key)?.id ?? null,
  }));
  const lessons = lessonsFor(user.layoutId);
  const firstOpen = lessons.findIndex((l) => !passed.has(l.id));
  const texts = LIBRARY.filter(
    (t) => t.language === user.contentLanguage && (user.interests.length === 0 || user.interests.includes(t.topic)),
  );
  const p = dict.practice;

  return (
    <>
      <Section title={p.adaptive.title} hint={p.adaptive.hint}>
        {targets.length ? (
          <div className="flex flex-wrap items-center gap-4">
            <Link href={`/${locale}/app/practice/adaptive/weak`} className={buttonVariants()}>
              {p.adaptive.start}
            </Link>
            <span className="font-mono text-sm text-fg-muted">
              {format(p.adaptive.targets, { targets: targets.map((k) => (k === " " ? "␣" : k)).join(", ") })}
            </span>
          </div>
        ) : (
          <p className="text-sm text-fg-muted">{p.adaptive.empty}</p>
        )}
      </Section>

      <Section title={p.ai.title} hint={p.ai.hint}>
        <AiExerciseCard
          locale={locale}
          topics={aiTopics}
          available={aiAvailable}
          quota={{ used: quota.used, limit: quota.limit }}
          t={p.ai}
        />
      </Section>

      <Section title={p.assessment.title} hint={p.assessment.hint}>
        <div>
          <Link
            href={`/${locale}/app/practice/assessment/${user.contentLanguage}`}
            className={buttonVariants({ variant: user.learning?.assessedAt ? "secondary" : "primary" })}
          >
            {p.assessment.start}
          </Link>
        </div>
      </Section>

      <Section title={p.lessons.title} hint={p.lessons.hint}>
        <ol className="grid gap-2 sm:grid-cols-2">
          {lessons.map((lesson, i) => {
            const done = passed.has(lesson.id);
            const isNext = i === firstOpen;
            return (
              <li key={lesson.id}>
                <Link
                  href={`/${locale}/app/practice/lesson/${lesson.id}`}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm transition-colors hover:bg-surface-2",
                    isNext ? "border-accent" : "border-border",
                  )}
                >
                  <span>
                    <span className="mr-2 font-mono text-fg-subtle">{String(i + 1).padStart(2, "0")}</span>
                    {dict.lessons[lesson.id as keyof Dictionary["lessons"]]}
                  </span>
                  {done ? (
                    <CheckCircle2 size={16} className="shrink-0 text-accent" aria-label={p.lessons.passed} />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ol>
      </Section>

      <Section title={p.speed.title} hint={p.speed.hint}>
        <div className="flex flex-wrap gap-2">
          {SPEED_DURATIONS.map((s) => (
            <Link key={s} href={`/${locale}/app/practice/speed/${s}`} className={buttonVariants({ variant: "secondary" })}>
              {s < 60 ? format(p.speed.seconds, { n: s }) : format(p.speed.minutes, { n: s / 60 })}
            </Link>
          ))}
        </div>
      </Section>

      <Section title={p.texts.title} hint={p.texts.hint}>
        <ul className="grid gap-2 sm:grid-cols-2">
          {texts.map((text) => (
            <li key={text.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-4 py-3 text-sm">
              <Link href={`/${locale}/app/practice/text/${text.id}`} className="hover:text-accent">
                <span className="block text-xs text-fg-muted">{dict.topics[text.topic]}</span>
                {text.title}
              </Link>
              <Link
                href={`/${locale}/app/practice/accuracy/${text.id}`}
                className="shrink-0 text-xs text-fg-muted hover:text-fg"
                title={p.texts.accuracyHint}
              >
                {p.texts.accuracy}
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
