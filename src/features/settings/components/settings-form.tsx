"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Alert, Input } from "@/components/ui/field";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { LAYOUTS, type LayoutId } from "@/features/typing-engine/layouts";
import { TOPICS, type TopicKey } from "@/content/topics";
import { DAILY_MINUTES } from "@/features/onboarding/schema";
import { format } from "@/lib/utils";
import { saveSettingsAction, type SettingsState } from "../actions";

type Labels = Pick<Dictionary, "settings" | "onboarding" | "topics" | "layouts">;

export type SettingsInitial = {
  contentLanguage: Locale;
  layoutId: LayoutId;
  interests: TopicKey[];
  dailyGoalMinutes: number;
  showVirtualKeyboard: boolean;
  targetWpm: number | null;
};

const fieldset = "flex flex-col gap-4 border-t border-border pt-6";
const legend = "mb-1 font-semibold";
const select = "h-10 w-full max-w-sm rounded-md border border-border-strong bg-surface px-3 text-sm";

export function SettingsForm({ locale, initial, t }: { locale: Locale; initial: SettingsInitial; t: Labels }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettingsAction, { status: "idle" });
  const s = t.settings;

  return (
    <form action={action} className="flex max-w-3xl flex-col gap-8">
      <fieldset className={fieldset}>
        <legend className={legend}>{s.learning}</legend>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{t.onboarding.language.title}</span>
          <select name="contentLanguage" defaultValue={initial.contentLanguage} className={select}>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </label>
        <div className="flex flex-col gap-2 text-sm">
          <span className="font-medium">{t.onboarding.interests.title}</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TOPICS.map((topic) => (
              <label key={topic} className="flex items-center gap-2">
                <input type="checkbox" name="interests" value={topic} defaultChecked={initial.interests.includes(topic)} className="accent-[var(--accent)]" />
                {t.topics[topic]}
              </label>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{t.onboarding.daily.title}</span>
          <select name="dailyGoalMinutes" defaultValue={String(initial.dailyGoalMinutes)} className={select}>
            {DAILY_MINUTES.map((m) => (
              <option key={m} value={m}>
                {format(t.onboarding.daily.minutes, { n: m })}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{s.targetWpm}</span>
          <Input
            name="targetWpm"
            type="number"
            min={10}
            max={200}
            inputMode="numeric"
            defaultValue={initial.targetWpm ?? ""}
            className="max-w-32"
            aria-describedby="target-hint"
          />
          <span id="target-hint" className="text-fg-muted">
            {s.targetHint}
          </span>
        </label>
      </fieldset>

      <fieldset className={fieldset}>
        <legend className={legend}>{s.keyboard}</legend>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{t.onboarding.layout.title}</span>
          <select name="layoutId" defaultValue={initial.layoutId} className={select}>
            {(Object.keys(LAYOUTS) as LayoutId[]).map((id) => (
              <option key={id} value={id}>
                {t.layouts[id]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="showVirtualKeyboard" defaultChecked={initial.showVirtualKeyboard} className="accent-[var(--accent)]" />
          {s.showKeyboard}
        </label>
      </fieldset>

      {state.status === "saved" ? <Alert tone="info">{s.saved}</Alert> : null}
      {state.status === "error" ? <Alert>{s.error}</Alert> : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {s.save}
        </Button>
        <Link href={`/${locale}/app/practice/assessment/${initial.contentLanguage}`} className={buttonVariants({ variant: "ghost" })}>
          {s.redoAssessment}
        </Link>
      </div>
    </form>
  );
}
