"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Alert } from "@/components/ui/field";
import { format } from "@/lib/utils";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { TypingStudio } from "@/features/typing-engine/components/typing-studio";
import { SessionResults } from "@/features/typing-engine/components/session-results";
import type { SessionSummary } from "@/features/typing-engine/stats";
import { saveSession, type SaveOutcome } from "@/features/sessions/client";
import { LESSON_PASS_ACCURACY } from "@/content/lessons";
import { nextLessonId, practiceText, type PracticeConfig } from "../config";

type Labels = Pick<Dictionary, "studio" | "results" | "app">;

type Finished = { summary: SummaryWithSave };
type SummaryWithSave = SessionSummary & { save: SaveOutcome | "saving" };

export function PracticeSession({
  locale,
  config,
  initialText,
  seed,
  showKeyboard,
  t,
}: {
  locale: Locale;
  config: PracticeConfig;
  initialText: string;
  seed: number;
  showKeyboard: boolean;
  t: Labels;
}) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [text, setText] = useState(initialText);
  const [finished, setFinished] = useState<Finished | null>(null);

  const onComplete = useCallback(
    (summary: SessionSummary, timing: { startedAt: Date; endedAt: Date }) => {
      setFinished({ summary: { ...summary, save: "saving" } });
      if (summary.keystrokes === 0) {
        setFinished({ summary: { ...summary, save: { status: "rejected", reason: "empty" } } });
        return;
      }
      void saveSession({
        clientSessionId: crypto.randomUUID(),
        mode: config.mode,
        exerciseKey: config.exerciseKey,
        layoutId: config.layoutId,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        startedAt: timing.startedAt.toISOString(),
        endedAt: timing.endedAt.toISOString(),
        // A timed exercise that ran to its time limit is complete even if text remains.
        completed: summary.completed || config.limit.type === "time",
        summary,
      }).then((save) => {
        setFinished({ summary: { ...summary, save } });
        // Dashboard / lesson progress may be cached by the client router: refetch them.
        if (save.status === "saved") router.refresh();
      });
    },
    [config, router],
  );

  const again = () => {
    const next = attempt + 1;
    setAttempt(next);
    setText(practiceText(config, next, seed));
    setFinished(null);
  };

  if (!finished) {
    return (
      <TypingStudio
        locale={locale}
        key={`${attempt}`}
        text={text}
        layout={config.layoutId}
        limit={config.limit}
        stopOnError={config.stopOnError}
        showKeyboard={showKeyboard}
        labels={t.studio}
        onComplete={onComplete}
      />
    );
  }

  const { summary } = finished;
  const r = t.results;
  const save = summary.save;
  const saveMessage =
    save === "saving"
      ? r.saving
      : save.status === "saved"
        ? r.saved
        : save.status === "queued"
          ? r.queued
          : save.status === "unauthenticated"
            ? r.unauthenticated
            : r.rejected;

  let feedback: React.ReactNode = null;
  if (config.kind === "lesson") {
    const passed = summary.completed && summary.accuracy >= LESSON_PASS_ACCURACY;
    feedback = (
      <Alert tone={passed ? "info" : "danger"}>
        {format(passed ? r.lessonPassed : r.lessonRetry, { n: LESSON_PASS_ACCURACY })}
      </Alert>
    );
  } else if (config.kind === "assessment" && save !== "saving" && save.status === "saved") {
    const { skillLevel, assessmentReliable } = save.result;
    feedback = (
      <Alert tone={assessmentReliable ? "info" : "danger"}>
        {assessmentReliable && skillLevel
          ? format(r.assessmentDone, { level: t.app.levels[skillLevel] })
          : r.assessmentUnreliable}
      </Alert>
    );
  }

  const nextLesson = config.kind === "lesson" ? nextLessonId(config.layoutId, config.id) : null;
  const lessonPassed = config.kind === "lesson" && summary.completed && summary.accuracy >= LESSON_PASS_ACCURACY;

  return (
    <SessionResults
      summary={summary}
      locale={locale}
      labels={r}
      status={
        <div className="flex flex-col gap-3">
          {feedback}
          <p className="text-sm text-fg-muted" role="status" data-testid="save-status">
            {saveMessage}
          </p>
        </div>
      }
      actions={
        <>
          {lessonPassed && nextLesson ? (
            <Link href={`/${locale}/app/practice/lesson/${nextLesson}`} className={buttonVariants()}>
              {r.nextLesson}
            </Link>
          ) : null}
          {config.kind === "assessment" ? (
            <Link href={`/${locale}/app`} className={buttonVariants()}>
              {r.dashboard}
            </Link>
          ) : null}
          <Button variant={lessonPassed || config.kind === "assessment" ? "secondary" : "primary"} onClick={again}>
            {r.again}
          </Button>
          <Link href={`/${locale}/app/practice`} className={buttonVariants({ variant: "ghost" })}>
            {r.back}
          </Link>
        </>
      }
    />
  );
}
