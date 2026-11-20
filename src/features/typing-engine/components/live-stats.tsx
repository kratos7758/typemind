"use client";

import { useEffect, useState } from "react";
import type { TypingEngine } from "../engine";
import { formatPercent } from "@/lib/format";

const fmtTime = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

type Labels = { wpm: string; accuracy: string; time: string; remaining: string };

/**
 * Live WPM / accuracy / time. Polls the engine 4×/s in its own component so the
 * text never re-renders because of the clock.
 */
export function LiveStats({ engine, labels, locale }: { engine: TypingEngine; labels: Labels; locale: string }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, []);

  const snap = engine.getSnapshot();
  const elapsed = engine.elapsedMs();
  const remaining = engine.remainingMs();
  const correctChars = snap.states.filter((s) => s === "correct" || s === "corrected").length;
  const wpm = elapsed > 1000 ? Math.round(correctChars / 5 / (elapsed / 60_000)) : 0;
  const accuracy = snap.keystrokes ? Math.round((snap.correctKeystrokes / snap.keystrokes) * 100) : 100;

  return (
    <dl className="flex items-baseline gap-8 font-mono tabular-nums">
      <div>
        <dt className="text-xs text-fg-muted">{labels.wpm}</dt>
        <dd className="text-2xl font-semibold" data-testid="live-wpm">
          {wpm}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-fg-muted">{labels.accuracy}</dt>
        <dd className="text-2xl font-semibold" data-testid="live-accuracy">
          {formatPercent(locale, accuracy, 0)}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-fg-muted">{remaining !== null ? labels.remaining : labels.time}</dt>
        <dd className="text-2xl font-semibold">{fmtTime(remaining ?? elapsed)}</dd>
      </div>
    </dl>
  );
}
