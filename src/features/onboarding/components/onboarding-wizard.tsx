"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/field";
import { cn, format } from "@/lib/utils";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { LAYOUTS, type LayoutId } from "@/features/typing-engine/layouts";
import { TOPICS, type TopicKey } from "@/content/topics";
import { saveOnboardingAction } from "../actions";
import { DAILY_MINUTES, EXPERIENCE, GOALS } from "../schema";

type Labels = Pick<Dictionary, "onboarding" | "topics" | "layouts">;

export type OnboardingInitial = {
  contentLanguage: Locale;
  layoutId: LayoutId;
  experience: (typeof EXPERIENCE)[number] | null;
  goals: string[];
  interests: TopicKey[];
  dailyGoalMinutes: number;
};

type KeyboardWithLayoutMap = { getLayoutMap?: () => Promise<Map<string, string>> };

/** Best-effort layout guess (Chromium Keyboard API). The user always confirms. */
async function detectLayout(): Promise<LayoutId | null> {
  const keyboard = (navigator as Navigator & { keyboard?: KeyboardWithLayoutMap }).keyboard;
  if (!keyboard?.getLayoutMap) return null;
  try {
    const map = await keyboard.getLayoutMap();
    if (map.get("KeyQ") === "a") return "fr-azerty";
    if (map.get("KeyY") === "z") return "de-qwertz";
    if (map.get("BracketRight") === "ç") return "ca-fr-csa";
    if (map.get("Backslash") === "#") return "uk-qwerty";
    if (map.get("KeyQ") === "q") return "us-qwerty";
  } catch {
    // Permission policy or unsupported: ignore.
  }
  return null;
}

function Choice({
  selected,
  onClick,
  children,
  multi,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  multi?: boolean;
}) {
  return (
    <button
      type="button"
      role={multi ? "checkbox" : "radio"}
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-left text-sm transition-colors",
        selected ? "border-accent bg-accent-soft text-fg" : "border-border-strong bg-surface hover:bg-surface-2",
      )}
    >
      <span>{children}</span>
      {selected ? <Check size={16} className="shrink-0 text-accent" aria-hidden /> : null}
    </button>
  );
}

export function OnboardingWizard({ locale, initial, t }: { locale: Locale; initial: OnboardingInitial; t: Labels }) {
  const o = t.onboarding;
  const [step, setStep] = useState(0);
  const [data, setData] = useState(initial);
  const [detected, setDetected] = useState<LayoutId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const layoutTouched = useRef(false);
  useEffect(() => {
    detectLayout().then((layout) => {
      if (!layout) return;
      setDetected(layout);
      // Never override a choice the user already made (detection can resolve late).
      if (!layoutTouched.current) setData((d) => ({ ...d, layoutId: layout }));
    });
  }, []);

  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const steps = [
    {
      title: o.language.title,
      hint: o.language.hint,
      body: (
        <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
          {(["fr", "en"] as const).map((l) => (
            <Choice key={l} selected={data.contentLanguage === l} onClick={() => setData({ ...data, contentLanguage: l })}>
              {l === "fr" ? "Français" : "English"}
            </Choice>
          ))}
        </div>
      ),
      valid: true,
    },
    {
      title: o.layout.title,
      hint: detected ? format(o.layout.detected, { layout: t.layouts[detected] }) : o.layout.hint,
      body: (
        <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(LAYOUTS) as LayoutId[]).map((id) => (
            <Choice
              key={id}
              selected={data.layoutId === id}
              onClick={() => {
                layoutTouched.current = true;
                setData({ ...data, layoutId: id });
              }}
            >
              {t.layouts[id]}
            </Choice>
          ))}
        </div>
      ),
      valid: true,
    },
    {
      title: o.experience.title,
      body: (
        <div role="radiogroup" className="grid gap-2">
          {EXPERIENCE.map((e) => (
            <Choice key={e} selected={data.experience === e} onClick={() => setData({ ...data, experience: e })}>
              {o.experience[e]}
            </Choice>
          ))}
        </div>
      ),
      valid: data.experience !== null,
    },
    {
      title: o.goals.title,
      hint: o.goals.hint,
      body: (
        <div className="grid gap-2 sm:grid-cols-2">
          {GOALS.map((g) => (
            <Choice key={g} multi selected={data.goals.includes(g)} onClick={() => setData({ ...data, goals: toggle(data.goals, g) })}>
              {o.goals[g]}
            </Choice>
          ))}
        </div>
      ),
      valid: true,
    },
    {
      title: o.interests.title,
      hint: o.interests.hint,
      body: (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TOPICS.map((topic) => (
            <Choice
              key={topic}
              multi
              selected={data.interests.includes(topic)}
              onClick={() => setData({ ...data, interests: toggle(data.interests, topic) })}
            >
              {t.topics[topic]}
            </Choice>
          ))}
        </div>
      ),
      valid: data.interests.length > 0,
    },
    {
      title: o.daily.title,
      hint: o.daily.hint,
      body: (
        <div role="radiogroup" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {DAILY_MINUTES.map((m) => (
            <Choice key={m} selected={data.dailyGoalMinutes === m} onClick={() => setData({ ...data, dailyGoalMinutes: m })}>
              {format(o.daily.minutes, { n: m })}
            </Choice>
          ))}
        </div>
      ),
      valid: true,
    },
  ];

  const current = steps[step];
  const last = step === steps.length - 1;

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveOnboardingAction({
        ...data,
        locale,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      // On success the action redirects; we only get here on failure.
      if (result && !result.ok) setError(result.error === "invalid" ? o.errors.interests : o.errors.generic);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-fg-muted" aria-live="polite">
        {format(o.step, { n: step + 1, total: steps.length })}
      </p>
      <div>
        <h2 className="text-xl font-semibold">{current.title}</h2>
        {current.hint ? <p className="mt-1 text-sm text-fg-muted">{current.hint}</p> : null}
      </div>
      {current.body}
      {error ? <Alert>{error}</Alert> : null}
      <div className="flex justify-between gap-3">
        <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 0 || pending}>
          {o.back}
        </Button>
        {last ? (
          <Button onClick={submit} disabled={!current.valid || pending}>
            {o.finish}
          </Button>
        ) : (
          <Button onClick={() => setStep(step + 1)} disabled={!current.valid}>
            {o.next}
          </Button>
        )}
      </div>
    </div>
  );
}
