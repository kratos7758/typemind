import { describe, expect, it } from "vitest";
import { TypingEngine } from "@/features/typing-engine/engine";
import { summarize } from "@/features/typing-engine/stats";
import { charsMatch, prepareText, toChars } from "@/features/typing-engine/text";

/** Manual clock: tests control time exactly. */
function clock(start = 1000) {
  let now = start;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

/** Types `text` one char at a time, `msPerChar` apart. */
function type(engine: TypingEngine, c: ReturnType<typeof clock>, text: string, msPerChar = 200) {
  for (const ch of Array.from(text)) {
    engine.insert(ch);
    c.advance(msPerChar);
  }
}

describe("text helpers", () => {
  it("normalises line breaks, ellipsis and NFC", () => {
    expect(prepareText("  Bonjour…\r\nça va ?  ")).toBe("Bonjour...\nça va ?");
    // "e" + combining circumflex (NFD) becomes a single "ê".
    expect(toChars("fête")).toEqual(["f", "ê", "t", "e"]);
  });

  it("accepts keyboard equivalents of typographic characters", () => {
    expect(charsMatch("’", "'")).toBe(true);
    expect(charsMatch("«", '"')).toBe(true);
    expect(charsMatch(" ", " ")).toBe(true);
    expect(charsMatch("—", "-")).toBe(true);
    expect(charsMatch("É", "E")).toBe(true); // no É key on French AZERTY
    expect(charsMatch("É", "É")).toBe(true);
    expect(charsMatch("E", "É")).toBe(false);
    expect(charsMatch("a", "A")).toBe(false);
    expect(charsMatch("é", "e")).toBe(false);
  });
});

describe("TypingEngine", () => {
  it("starts on the first keystroke, not before", () => {
    const c = clock();
    const e = new TypingEngine("abc", { now: c.now });
    c.advance(5000);
    expect(e.getSnapshot().status).toBe("idle");
    expect(e.elapsedMs()).toBe(0);
    e.insert("a");
    expect(e.getSnapshot().status).toBe("running");
  });

  it("marks correct and incorrect characters and advances the cursor", () => {
    const c = clock();
    const e = new TypingEngine("chat", { now: c.now });
    type(e, c, "cx");
    const s = e.getSnapshot();
    expect(s.states).toEqual(["correct", "incorrect", "pending", "pending"]);
    expect(s.typed[1]).toBe("x");
    expect(s.cursor).toBe(2);
  });

  it("Backspace resets the position; retyping correctly marks it as corrected", () => {
    const c = clock();
    const e = new TypingEngine("chat", { now: c.now });
    type(e, c, "cx");
    e.deleteBackward();
    expect(e.getSnapshot().states[1]).toBe("pending");
    type(e, c, "hat");
    const s = e.getSnapshot();
    expect(s.states).toEqual(["correct", "corrected", "correct", "correct"]);
    expect(s.status).toBe("finished");
  });

  it("stop-on-error mode does not advance past a wrong key", () => {
    const c = clock();
    const e = new TypingEngine("ab", { now: c.now, stopOnError: true });
    type(e, c, "axb");
    const s = e.getSnapshot();
    expect(s.states).toEqual(["correct", "corrected"]);
    expect(s.keystrokes).toBe(3);
    expect(s.status).toBe("finished");
  });

  it("Ctrl+Backspace deletes back to the start of the word", () => {
    const c = clock();
    const e = new TypingEngine("le chat noir", { now: c.now });
    type(e, c, "le cha");
    e.deleteWordBackward();
    expect(e.getSnapshot().cursor).toBe(3);
    e.deleteWordBackward(); // "le " → start
    expect(e.getSnapshot().cursor).toBe(0);
  });

  it("ignores input after the end of the text and while paused", () => {
    const c = clock();
    const e = new TypingEngine("ab", { now: c.now });
    type(e, c, "a");
    e.pause();
    e.insert("b");
    expect(e.getSnapshot().cursor).toBe(1);
    e.resume();
    type(e, c, "bzz");
    expect(e.getSnapshot().keystrokes).toBe(2);
  });

  it("excludes paused time from elapsed time", () => {
    const c = clock();
    const e = new TypingEngine("abcd", { now: c.now });
    e.insert("a");
    c.advance(1000);
    e.pause();
    c.advance(60_000);
    e.resume();
    c.advance(1000);
    e.insert("b");
    expect(e.elapsedMs()).toBe(2000);
  });

  it("timed exercises end when the time is up and reject later input", () => {
    const c = clock();
    const e = new TypingEngine("abcdefghij", { now: c.now, limit: { type: "time", durationMs: 1000 } });
    type(e, c, "abc", 400); // third char arrives at t=800, then clock → 1200
    e.insert("d"); // t=1200 > limit
    expect(e.getSnapshot().status).toBe("finished");
    expect(e.getSnapshot().keystrokes).toBe(3);
    expect(e.elapsedMs()).toBe(1000); // capped at the limit even though detected at 1200
  });

  it("tick() finishes a timed exercise without input", () => {
    const c = clock();
    const e = new TypingEngine("abcdef", { now: c.now, limit: { type: "time", durationMs: 1000 } });
    e.insert("a");
    c.advance(999);
    e.tick();
    expect(e.getSnapshot().status).toBe("running");
    c.advance(2);
    e.tick();
    expect(e.getSnapshot().status).toBe("finished");
  });

  it("handles a multi-character composed string (IME / dead keys)", () => {
    const c = clock();
    const e = new TypingEngine("fête", { now: c.now });
    e.insert("f");
    e.insert("ê"); // NFD from an IME
    e.insert("te");
    expect(e.getSnapshot().states.every((s) => s === "correct")).toBe(true);
  });

  it("notifies subscribers with a new snapshot object", () => {
    const e = new TypingEngine("ab");
    const before = e.getSnapshot();
    let calls = 0;
    const unsubscribe = e.subscribe(() => calls++);
    e.insert("a");
    expect(calls).toBe(1);
    expect(e.getSnapshot()).not.toBe(before);
    unsubscribe();
    e.insert("b");
    expect(calls).toBe(1);
  });
});

describe("summarize", () => {
  it("computes net/raw WPM and accuracy with documented formulas", () => {
    const c = clock();
    // 10 chars, one error corrected → 11 keystrokes, 10 correct
    const e = new TypingEngine("abcde fghi", { now: c.now });
    type(e, c, "abcdx", 600);
    e.deleteBackward();
    type(e, c, "e fghi", 600);
    const r = summarize(e.result());
    // keystrokes are 600 ms apart; elapsed = time of last keystroke = 10 intervals × 600 = 6000 ms
    expect(r.durationMs).toBe(6000);
    expect(r.keystrokes).toBe(11);
    expect(r.correctKeystrokes).toBe(10);
    expect(r.netWpm).toBe(20); // 10/5 / 0.1 min
    expect(r.rawWpm).toBe(22); // 11/5 / 0.1 min
    expect(r.accuracy).toBe(90.9);
    expect(r.correctedErrors).toBe(1);
    expect(r.uncorrectedErrors).toBe(0);
    expect(r.completed).toBe(true);
  });

  it("counts uncorrected errors and excludes them from net WPM", () => {
    const c = clock();
    const e = new TypingEngine("abcde", { now: c.now });
    type(e, c, "abxde", 600);
    const r = summarize(e.result());
    expect(r.uncorrectedErrors).toBe(1);
    expect(r.netWpm).toBeLessThan(r.rawWpm);
  });

  it("per-key stats count first attempts only and fold typographic variants", () => {
    const c = clock();
    const e = new TypingEngine("l’a", { now: c.now });
    type(e, c, "lx");
    e.deleteBackward();
    type(e, c, "'a");
    const { keys } = summarize(e.result());
    expect(keys["'"]).toMatchObject({ attempts: 1, errors: 1 });
    expect(keys["a"]).toMatchObject({ attempts: 1, errors: 0 });
    expect(keys["’"]).toBeUndefined();
  });

  it("bigrams ignore whitespace and are case-insensitive", () => {
    const c = clock();
    const e = new TypingEngine("Le le", { now: c.now });
    type(e, c, "Le le");
    const { bigrams } = summarize(e.result());
    expect(Object.keys(bigrams)).toEqual(["le"]);
    expect(bigrams.le.attempts).toBe(2);
  });

  it("excludes idle gaps from latency and consistency", () => {
    const c = clock();
    const e = new TypingEngine("abcdefghijklm", { now: c.now });
    type(e, c, "abcdef", 200);
    c.advance(10_000); // distraction
    type(e, c, "ghijklm", 200);
    const r = summarize(e.result());
    expect(r.keys["g"].latencySamples).toBe(0);
    expect(r.keys["h"].totalLatencyMs).toBe(200);
    expect(r.consistency).toBe(100); // perfectly regular apart from the excluded gap
  });

  it("returns null consistency when there are too few keystrokes", () => {
    const c = clock();
    const e = new TypingEngine("abc", { now: c.now });
    type(e, c, "abc");
    expect(summarize(e.result()).consistency).toBeNull();
  });

  it("produces one timeline point per second of active typing", () => {
    const c = clock();
    const e = new TypingEngine("abcdefghij", { now: c.now });
    type(e, c, "abcdefghij", 250); // last keystroke at 2250 ms
    const { timeline } = summarize(e.result());
    expect(timeline).toHaveLength(3);
    expect(timeline.map((p) => p.t)).toEqual([1, 2, 3]);
    expect(timeline.reduce((a, p) => a + p.errors, 0)).toBe(0);
  });

  it("an empty session yields zeros, not NaN", () => {
    const r = summarize(new TypingEngine("abc").result());
    expect(r).toMatchObject({ netWpm: 0, rawWpm: 0, accuracy: 0, keystrokes: 0 });
  });
});
