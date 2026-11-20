"use client";

import { memo, useLayoutEffect, useMemo, useRef } from "react";
import type { CharState, EngineSnapshot } from "../engine";
import { isWhitespace } from "../text";

type Chunk = { start: number; end: number };

/** Groups characters into words (+ trailing whitespace) so that only touched words re-render. */
function chunk(chars: readonly string[]): Chunk[] {
  const chunks: Chunk[] = [];
  let start = 0;
  for (let i = 0; i < chars.length; i++) {
    const endsChunk = isWhitespace(chars[i]) && (i + 1 >= chars.length || !isWhitespace(chars[i + 1]));
    if (endsChunk || i === chars.length - 1) {
      chunks.push({ start, end: i + 1 });
      start = i + 1;
    }
  }
  return chunks;
}

const STATE_CLASS: Record<CharState, string> = {
  pending: "text-[var(--type-pending)]",
  correct: "text-[var(--type-correct)]",
  corrected: "text-[var(--type-correct)] underline decoration-[var(--warning)] decoration-2 underline-offset-4",
  incorrect: "text-[var(--type-error)] bg-danger-soft rounded-[2px]",
};

type WordProps = {
  chars: readonly string[];
  states: readonly CharState[];
  typed: readonly (string | undefined)[];
  start: number;
  end: number;
  /** Cursor position if it falls inside this word, else -1. */
  cursor: number;
};

const Word = memo(
  function Word({ chars, states, typed, start, end, cursor }: WordProps) {
    const spans = [];
    for (let i = start; i < end; i++) {
      const ch = chars[i];
      const state = states[i];
      const isCursor = i === cursor;
      const display = ch === "\n" ? "↵" : ch;
      spans.push(
        <span
          key={i}
          data-cursor={isCursor || undefined}
          title={state === "incorrect" && typed[i] ? `« ${typed[i]} »` : undefined}
          className={`${STATE_CLASS[state]} ${isCursor ? "typing-cursor" : ""} ${ch === "\n" ? "opacity-50" : ""}`}
        >
          {display}
        </span>,
      );
      if (ch === "\n") spans.push(<br key={`br-${i}`} />);
    }
    return <span className="whitespace-pre-wrap">{spans}</span>;
  },
  (prev, next) => {
    if (prev.cursor !== next.cursor || prev.chars !== next.chars) return false;
    for (let i = prev.start; i < prev.end; i++) {
      if (prev.states[i] !== next.states[i] || prev.typed[i] !== next.typed[i]) return false;
    }
    return true;
  },
);

/**
 * Renders the exercise text with per-character feedback and a caret.
 * Shows three lines at a time and scrolls so the caret stays on the second line.
 */
export function TypingText({ snapshot, focused }: { snapshot: EngineSnapshot; focused: boolean }) {
  const { chars, states, typed, cursor } = snapshot;
  const chunks = useMemo(() => chunk(chars), [chars]);
  const fullText = useMemo(() => chars.join(""), [chars]);
  const viewport = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const caret = inner.current?.querySelector<HTMLElement>("[data-cursor]");
    if (!caret || !inner.current) return;
    const lineHeight = parseFloat(getComputedStyle(inner.current).lineHeight) || 40;
    const offset = Math.max(0, caret.offsetTop - lineHeight);
    inner.current.style.transform = `translateY(${-offset}px)`;
  }, [cursor]);

  return (
    <div
      ref={viewport}
      className="relative h-[calc(3*var(--typing-line))] overflow-hidden font-mono text-[1.6rem] leading-[var(--typing-line)] [--typing-line:2.6rem] sm:text-[1.75rem]"
      data-focused={focused || undefined}
      data-testid="typing-text"
      data-text={fullText}
    >
      <div ref={inner} className="transition-transform duration-150 ease-out motion-reduce:transition-none">
        {chunks.map((c) => (
          <Word
            key={c.start}
            chars={chars}
            states={states}
            typed={typed}
            start={c.start}
            end={c.end}
            cursor={cursor >= c.start && cursor < c.end ? cursor : -1}
          />
        ))}
      </div>
    </div>
  );
}
