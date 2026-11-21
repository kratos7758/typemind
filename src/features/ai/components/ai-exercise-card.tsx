"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/field";
import { format } from "@/lib/utils";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import type { TopicKey } from "@/content/topics";

type Labels = Dictionary["practice"]["ai"];

type Props = {
  locale: Locale;
  topics: { key: TopicKey; label: string; libraryId: string | null }[];
  available: boolean;
  /** Guests must create an account first (enforced by the API too). */
  guest: boolean;
  quota: { used: number; limit: number };
  t: Labels;
};

type State =
  | { status: "idle" }
  | { status: "account" }
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "quota" }
  | { status: "failed" };

/**
 * Requests an AI exercise and opens it. Every outcome is shown honestly:
 * AI disabled on the server, monthly quota reached, or generation failure.
 */
export function AiExerciseCard({ locale, topics, available, guest, quota, t }: Props) {
  const router = useRouter();
  const [topic, setTopic] = useState<TopicKey>(topics[0]?.key ?? "science");
  const [state, setState] = useState<State>(
    !available
      ? { status: "unavailable" }
      : guest
        ? { status: "account" }
        : quota.used >= quota.limit
          ? { status: "quota" }
          : { status: "idle" },
  );
  const libraryId = topics.find((x) => x.key === topic)?.libraryId;

  const generate = async () => {
    setState({ status: "loading" });
    try {
      const response = await fetch("/api/ai/exercise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const body = (await response.json().catch(() => ({}))) as { exerciseId?: string };
      if (response.status === 201 && body.exerciseId) {
        router.push(`/${locale}/app/practice/ai/${body.exerciseId}`);
        return;
      }
      setState({
        status:
          response.status === 503
            ? "unavailable"
            : response.status === 429
              ? "quota"
              : response.status === 403
                ? "account"
                : "failed",
      });
    } catch {
      setState({ status: "failed" });
    }
  };

  const remaining = Math.max(0, quota.limit - quota.used);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{t.topic}</span>
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value as TopicKey)}
            className="h-10 rounded-md border border-border-strong bg-surface px-3 text-sm"
          >
            {topics.map((x) => (
              <option key={x.key} value={x.key}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
        <Button
          onClick={generate}
          disabled={
            state.status === "loading" ||
            state.status === "unavailable" ||
            state.status === "quota" ||
            state.status === "account"
          }
        >
          {state.status === "loading" ? t.generating : t.generate}
        </Button>
        {available && !guest ? (
          <span className="pb-2.5 text-sm text-fg-muted">{format(t.remaining, { remaining, limit: quota.limit })}</span>
        ) : null}
      </div>

      {state.status === "account" ? (
        <Alert tone="info">
          <span className="block">{t.accountRequired}</span>
          <Link href={`/${locale}/register`} className="mt-1 inline-block font-medium underline">
            {t.createAccount}
          </Link>
        </Alert>
      ) : null}

      {state.status === "unavailable" || state.status === "quota" || state.status === "failed" ? (
        <Alert tone={state.status === "failed" ? "danger" : "info"}>
          <span className="block">
            {state.status === "unavailable" ? t.unavailable : state.status === "quota" ? format(t.quota, { limit: quota.limit }) : t.failed}
          </span>
          {libraryId ? (
            <Link href={`/${locale}/app/practice/text/${libraryId}`} className="mt-1 inline-block font-medium underline">
              {t.openLibrary}
            </Link>
          ) : null}
        </Alert>
      ) : null}
    </div>
  );
}
