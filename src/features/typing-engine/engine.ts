/**
 * TypingEngine — framework-agnostic state machine for a typing exercise.
 *
 * - No React, no DOM, no network. Time comes from an injectable clock.
 * - Receives already-decoded characters (`insert`) and deletions; decoding
 *   keyboard/IME events is the job of the input adapter (input-adapter.ts).
 * - Exposes immutable snapshots for `useSyncExternalStore`.
 * - Keeps a keystroke log in memory; only aggregates leave the browser (ADR-010).
 */
import { charsMatch, toChars } from "./text";

export type CharState = "pending" | "correct" | "incorrect" | "corrected";
export type EngineStatus = "idle" | "running" | "paused" | "finished";

export type Keystroke = {
  /** Active typing time (ms since start, pauses excluded). */
  t: number;
  index: number;
  expected: string;
  actual: string;
  correct: boolean;
  /** First attempt at this position (used for latency / per-key stats). */
  firstAttempt: boolean;
};

export type EngineOptions = {
  /** "timed": finishes after `durationMs` of active typing, or at end of text. */
  limit?: { type: "text" } | { type: "time"; durationMs: number };
  /** If true, a wrong character is counted but the cursor does not advance. */
  stopOnError?: boolean;
  now?: () => number;
};

export type EngineSnapshot = {
  readonly status: EngineStatus;
  readonly chars: readonly string[];
  readonly states: readonly CharState[];
  /** Wrong characters actually typed, by position (for display). */
  readonly typed: readonly (string | undefined)[];
  readonly cursor: number;
  readonly keystrokes: number;
  readonly correctKeystrokes: number;
  readonly lastKeystrokeCorrect: boolean | null;
};

type Listener = () => void;

export class TypingEngine {
  private readonly chars: string[];
  private readonly opts: Required<Omit<EngineOptions, "limit">> & { limit: NonNullable<EngineOptions["limit"]> };

  private status: EngineStatus = "idle";
  private states: CharState[];
  private typed: (string | undefined)[];
  private hadError: boolean[];
  private attempted: boolean[];
  private cursor = 0;
  private log: Keystroke[] = [];
  private correctCount = 0;
  private lastCorrect: boolean | null = null;

  private startedAt = 0; // clock time when (re)started running
  private accumulated = 0; // active ms before the current running stretch
  private startedWallClock: Date | null = null;
  private endedWallClock: Date | null = null;

  private snapshot: EngineSnapshot;
  private listeners = new Set<Listener>();

  constructor(text: string, options: EngineOptions = {}) {
    this.chars = toChars(text);
    if (this.chars.length === 0) throw new Error("TypingEngine: empty text");
    this.opts = {
      limit: options.limit ?? { type: "text" },
      stopOnError: options.stopOnError ?? false,
      now: options.now ?? (() => performance.now()),
    };
    this.states = this.chars.map(() => "pending");
    this.typed = this.chars.map(() => undefined);
    this.hadError = this.chars.map(() => false);
    this.attempted = this.chars.map(() => false);
    this.snapshot = this.buildSnapshot();
  }

  // ---------- subscription (useSyncExternalStore) ----------

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): EngineSnapshot => this.snapshot;

  private emit() {
    this.snapshot = this.buildSnapshot();
    for (const l of this.listeners) l();
  }

  private buildSnapshot(): EngineSnapshot {
    return {
      status: this.status,
      chars: this.chars,
      states: this.states.slice(),
      typed: this.typed.slice(),
      cursor: this.cursor,
      keystrokes: this.log.length,
      correctKeystrokes: this.correctCount,
      lastKeystrokeCorrect: this.lastCorrect,
    };
  }

  // ---------- time ----------

  /** Active typing time in ms (pauses excluded). */
  elapsedMs(): number {
    if (this.status === "running") return this.accumulated + (this.opts.now() - this.startedAt);
    return this.accumulated;
  }

  /** Remaining ms in a timed exercise, otherwise null. */
  remainingMs(): number | null {
    const limit = this.opts.limit;
    if (limit.type !== "time") return null;
    return Math.max(0, limit.durationMs - this.elapsedMs());
  }

  /** Call periodically (e.g. every 100 ms) so timed exercises end on time. */
  tick(): void {
    const remaining = this.remainingMs();
    if (this.status === "running" && remaining !== null && remaining <= 0) {
      this.finish();
      // Detection can lag (timer granularity, late keystroke): never count more than the limit.
      if (this.opts.limit.type === "time") {
        this.accumulated = Math.min(this.accumulated, this.opts.limit.durationMs);
      }
    }
  }

  // ---------- input ----------

  /** Inserts one or more characters (a composed IME string may contain several). */
  insert(text: string): void {
    if (this.isFinished() || this.status === "paused") return;
    this.tick();
    if (this.isFinished()) return; // time ran out before this input
    for (const ch of toChars(text)) {
      if (this.cursor >= this.chars.length) break;
      this.insertChar(ch);
      if (this.isFinished()) break;
    }
    this.emit();
  }

  /** Method (not an inline check) so TypeScript doesn't narrow across calls that mutate status. */
  private isFinished(): boolean {
    return this.status === "finished";
  }

  private insertChar(actual: string): void {
    if (this.status === "idle") this.start();

    const index = this.cursor;
    const expected = this.chars[index];
    const correct = charsMatch(expected, actual);
    const firstAttempt = !this.attempted[index];
    this.attempted[index] = true;

    this.log.push({ t: this.elapsedMs(), index, expected, actual, correct, firstAttempt });
    this.lastCorrect = correct;

    if (correct) {
      this.correctCount++;
      this.states[index] = this.hadError[index] ? "corrected" : "correct";
      this.typed[index] = undefined;
      this.cursor++;
    } else {
      this.hadError[index] = true;
      if (!this.opts.stopOnError) {
        this.states[index] = "incorrect";
        this.typed[index] = actual;
        this.cursor++;
      }
    }

    if (this.cursor >= this.chars.length) this.finish(false);
  }

  /** Backspace: removes the previous character. */
  deleteBackward(): void {
    if (this.status !== "running" || this.cursor === 0) return;
    this.cursor--;
    this.states[this.cursor] = "pending";
    this.typed[this.cursor] = undefined;
    this.emit();
  }

  /** Ctrl/Alt+Backspace: removes back to the start of the current (or previous) word. */
  deleteWordBackward(): void {
    if (this.status !== "running" || this.cursor === 0) return;
    let i = this.cursor;
    while (i > 0 && /\s/.test(this.chars[i - 1])) i--; // trailing spaces
    while (i > 0 && !/\s/.test(this.chars[i - 1])) i--; // the word itself
    for (let k = i; k < this.cursor; k++) {
      this.states[k] = "pending";
      this.typed[k] = undefined;
    }
    this.cursor = i;
    this.emit();
  }

  // ---------- lifecycle ----------

  private start() {
    this.status = "running";
    this.startedAt = this.opts.now();
    this.startedWallClock = new Date();
  }

  pause(): void {
    if (this.status !== "running") return;
    this.accumulated = this.elapsedMs();
    this.status = "paused";
    this.emit();
  }

  resume(): void {
    if (this.status !== "paused") return;
    this.startedAt = this.opts.now();
    this.status = "running";
    this.emit();
  }

  /** Ends the exercise (end of text, time limit, or user action). */
  finish(emit = true): void {
    if (this.status === "finished") return;
    if (this.status === "running") this.accumulated = this.elapsedMs();
    this.status = "finished";
    this.endedWallClock = new Date();
    if (emit) this.emit();
  }

  // ---------- results ----------

  /** Raw data for statistics (see stats.ts). */
  result() {
    return {
      chars: this.chars,
      states: this.states.slice(),
      keystrokes: this.log.slice(),
      elapsedMs: this.elapsedMs(),
      startedAt: this.startedWallClock,
      endedAt: this.endedWallClock,
      completed: this.cursor >= this.chars.length,
    };
  }
}

export type EngineResult = ReturnType<TypingEngine["result"]>;
