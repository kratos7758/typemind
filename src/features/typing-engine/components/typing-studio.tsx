"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EngineOptions } from "../engine";
import { attachInputAdapter } from "../input-adapter";
import { strokesFor, type LayoutId } from "../layouts";
import { summarize, type SessionSummary } from "../stats";
import { typedForm } from "../text";
import { useTypingEngine } from "../use-typing-engine";
import { LiveStats } from "./live-stats";
import { TypingText } from "./typing-text";
import { VirtualKeyboard } from "./virtual-keyboard";

export type StudioLabels = {
  inputLabel: string;
  clickToFocus: string;
  paused: string;
  pause: string;
  resume: string;
  restart: string;
  shortcuts: string;
  finger: string;
  noHint: string;
  fingers: Record<string, string>;
  stats: { wpm: string; accuracy: string; time: string; remaining: string };
  keys: { shift: string; enter: string; space: string; backspace: string; tab: string; caps: string; altgr: string };
};

type Props = {
  locale: string;
  text: string;
  layout: LayoutId;
  limit?: EngineOptions["limit"];
  stopOnError?: boolean;
  showKeyboard?: boolean;
  labels: StudioLabels;
  onComplete: (summary: SessionSummary, timing: { startedAt: Date; endedAt: Date }) => void;
};

/**
 * The Typing Studio. Remount with a new `key` to change text or options.
 */
export function TypingStudio({ locale, text, layout, limit, stopOnError, showKeyboard = true, labels, onComplete }: Props) {
  const { engine, snapshot, restart } = useTypingEngine(text, { limit, stopOnError });
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const completedRef = useRef<object | null>(null);

  // Wire the DOM input to the current engine.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const detach = attachInputAdapter(el, engine, {
      onCommand: (cmd) => {
        if (cmd === "tab") restart();
        else if (engine.getSnapshot().status === "paused") engine.resume();
        else engine.pause();
      },
    });
    el.focus({ preventScroll: true });
    return detach;
  }, [engine, restart]);

  // Report completion exactly once per engine.
  useEffect(() => {
    if (snapshot.status !== "finished" || completedRef.current === engine) return;
    completedRef.current = engine;
    const result = engine.result();
    onComplete(summarize(result), {
      startedAt: result.startedAt ?? new Date(),
      endedAt: result.endedAt ?? new Date(),
    });
  }, [snapshot.status, engine, onComplete]);

  const focusInput = () => {
    inputRef.current?.focus({ preventScroll: true });
    if (engine.getSnapshot().status === "paused") engine.resume();
  };
  /** Buttons must not steal focus from the input (blur would pause the exercise). */
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();
  const showOverlay = snapshot.status !== "finished" && (!focused || snapshot.status === "paused");

  const onBlur = () => {
    setFocused(false);
    engine.pause(); // keep timing fair when the user switches away
  };

  const onFocus = () => {
    setFocused(true);
    if (engine.getSnapshot().status === "paused") engine.resume();
  };

  const nextChar = snapshot.chars[snapshot.cursor];
  // Prefer the exact character when the layout can produce it (e.g. É on Canadian layouts).
  const strokes =
    nextChar !== undefined ? (strokesFor(layout, nextChar) ?? strokesFor(layout, typedForm(nextChar))) : null;
  const finger = strokes?.[strokes.length - 1]?.finger;

  return (
    <section className="flex flex-col gap-8" data-status={snapshot.status}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <LiveStats engine={engine} labels={labels.stats} locale={locale} />
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onMouseDown={keepFocus}
            onClick={() => (snapshot.status === "paused" ? engine.resume() : engine.pause())}
            disabled={snapshot.status !== "running" && snapshot.status !== "paused"}
          >
            {snapshot.status === "paused" ? <Play size={16} aria-hidden /> : <Pause size={16} aria-hidden />}
            {snapshot.status === "paused" ? labels.resume : labels.pause}
          </Button>
          <Button variant="ghost" size="sm" onMouseDown={keepFocus} onClick={restart}>
            <RotateCcw size={16} aria-hidden />
            {labels.restart}
          </Button>
        </div>
      </div>

      <div className="relative cursor-text" onClick={focusInput}>
        <textarea
          ref={inputRef}
          aria-label={labels.inputLabel}
          onFocus={onFocus}
          onBlur={onBlur}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="absolute h-px w-px opacity-0"
          data-testid="typing-input"
        />
        <TypingText snapshot={snapshot} focused={focused} />
        {showOverlay ? (
          <div className="absolute inset-0 flex items-center justify-center bg-bg/70 backdrop-blur-[2px]">
            <p className="rounded-md bg-surface px-4 py-2 text-sm text-fg shadow-sm">
              {snapshot.status === "paused" ? labels.paused : labels.clickToFocus}
            </p>
          </div>
        ) : null}
      </div>

      {showKeyboard ? (
        <div className="flex flex-col gap-3">
          <p className="text-center text-sm text-fg-muted" aria-live="off">
            {finger ? `${labels.finger} : ${labels.fingers[finger]}` : nextChar !== undefined ? labels.noHint : ""}
          </p>
          <VirtualKeyboard layout={layout} strokes={strokes} labels={labels.keys} />
        </div>
      ) : null}

      <p className="text-center text-xs text-fg-subtle">{labels.shortcuts}</p>
    </section>
  );
}
