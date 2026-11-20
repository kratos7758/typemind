import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { requireOnboardedUser } from "@/features/account/guards";
import { getAiExercise } from "@/features/account/queries";
import { practiceText, resolvePractice, type PracticeContext } from "@/features/practice/config";
import { requestSeed } from "@/features/practice/seed";
import { PracticeSession } from "@/features/practice/components/practice-session";
import { format } from "@/lib/utils";

export default async function PracticeRunPage({ params }: PageProps<"/[locale]/app/practice/[kind]/[id]">) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return (
    <Suspense fallback={<p className="text-fg-muted">{dict.common.loading}</p>}>
      <Runner locale={locale} dict={dict} params={params} />
    </Suspense>
  );
}

const keyName = (k: string) => (k === " " ? "␣" : k);

async function Runner({
  locale,
  dict,
  params,
}: {
  locale: Locale;
  dict: Dictionary;
  params: Promise<{ kind: string; id: string }>;
}) {
  const { kind, id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const { claims, user } = await requireOnboardedUser(locale);

  const context: PracticeContext = {};
  if (kind === "adaptive") {
    context.targets = { keys: user.learning?.weakKeys ?? [], bigrams: user.learning?.weakBigrams ?? [] };
  } else if (kind === "ai") {
    const ex = await getAiExercise(claims, id);
    context.aiExercise = ex && {
      ...ex,
      explanation: ex.targetChars.length
        ? format(dict.practice.ai.targets, { targets: ex.targetChars.map(keyName).join(", ") })
        : null,
    };
  }

  const config = resolvePractice(kind, id, user, context);
  if (!config) notFound();

  const seed = await requestSeed();
  const text = practiceText(config, 0, seed);
  if (!text) notFound();

  const p = dict.practice;
  const title =
    config.kind === "lesson"
      ? dict.lessons[config.id as keyof Dictionary["lessons"]]
      : config.kind === "speed"
        ? `${p.speed.title} — ${format(p.speed.seconds, { n: config.id })}`
        : config.kind === "assessment"
          ? dict.assessment.title
          : config.kind === "accuracy"
            ? `${p.texts.accuracy} — ${config.title}`
            : config.kind === "adaptive"
              ? p.adaptive.title
              : config.title;

  const intro =
    config.kind === "assessment"
      ? dict.assessment.intro
      : config.kind === "accuracy"
        ? p.texts.accuracyHint
        : config.kind === "adaptive" && config.targets
          ? format(p.adaptive.targets, {
              targets: [...config.targets.keys, ...config.targets.bigrams].map(keyName).join(", "),
            })
          : config.kind === "ai"
            ? config.explanation
            : null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {intro ? <p className="mt-2 max-w-2xl text-fg-muted">{intro}</p> : null}
      </div>
      <PracticeSession
        locale={locale}
        config={config}
        initialText={text}
        seed={seed}
        showKeyboard={user.showVirtualKeyboard}
        t={{ studio: dict.studio, results: dict.results, app: dict.app }}
      />
    </div>
  );
}
