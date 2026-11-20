import { describe, expect, it } from "vitest";
import { dailySeries, heatBucket, keyHeat, records, slowestKeys, type SessionRow } from "@/features/analytics/compute";

const row = (o: Partial<SessionRow>): SessionRow => ({
  mode: "speed_test",
  status: "completed",
  endedAt: new Date("2026-11-18T15:00:00Z"),
  durationMs: 60_000,
  netWpm: 40,
  accuracy: 95,
  keystrokes: 200,
  ...o,
});

describe("dailySeries", () => {
  it("averages per local day, weighted by keystrokes", () => {
    const s = dailySeries([
      row({ netWpm: 40, keystrokes: 300 }),
      row({ netWpm: 60, keystrokes: 100, endedAt: new Date("2026-11-18T20:00:00Z") }),
      row({ netWpm: 30, endedAt: new Date("2026-11-17T15:00:00Z") }),
    ]);
    expect(s).toEqual([
      { date: "2026-11-17", wpm: 30, accuracy: 95, sessions: 1 },
      { date: "2026-11-18", wpm: 45, accuracy: 95, sessions: 2 },
    ]);
  });

  it("excludes lessons and too-short sessions", () => {
    expect(dailySeries([row({ mode: "lesson" }), row({ keystrokes: 10 })])).toEqual([]);
  });

  it("groups by the user's local date", () => {
    const lateEvening = row({ endedAt: new Date("2026-11-18T03:00:00Z") }); // Nov 17 in Toronto
    expect(dailySeries([lateEvening], "America/Toronto")[0].date).toBe("2026-11-17");
  });
});

describe("records", () => {
  it("only counts completed sessions of the right kind", () => {
    const r = records([
      row({ netWpm: 55 }),
      row({ netWpm: 80, status: "abandoned" }),
      row({ mode: "assessment", netWpm: 90 }),
      row({ mode: "adaptive", accuracy: 98.5 }),
      row({ mode: "accuracy", accuracy: 99, status: "abandoned" }),
    ]);
    expect(r.bestSpeedTestWpm).toBe(55);
    expect(r.bestTextAccuracy).toBe(98.5);
    expect(r.sessions).toBe(5);
    expect(r.practiceDays).toBe(1);
    expect(r.totalPracticeMs).toBe(300_000);
  });

  it("returns nulls when nothing qualifies", () => {
    expect(records([])).toMatchObject({ bestSpeedTestWpm: null, bestTextAccuracy: null, sessions: 0 });
  });
});

describe("keyHeat", () => {
  it("merges lower and upper case on the same physical key, weighted by attempts", () => {
    const heat = keyHeat("fr-azerty", [
      { char: "a", attempts: 90, errors: 0, ewmaErrorRate: 0.1, ewmaLatencyMs: 200 },
      { char: "A", attempts: 10, errors: 0, ewmaErrorRate: 0.2, ewmaLatencyMs: 300 },
      { char: "ê", attempts: 50, errors: 0, ewmaErrorRate: 0.5, ewmaLatencyMs: 300 }, // dead-key sequence: skipped
    ]);
    const a = heat.get("KeyQ")!; // AZERTY "a"
    expect(a.attempts).toBe(100);
    expect(a.errorRate).toBeCloseTo(0.11);
    expect(heat.size).toBe(1);
  });

  it("buckets error rates", () => {
    expect([0, 0.03, 0.07, 0.2].map(heatBucket)).toEqual([0, 1, 2, 3]);
  });

  it("slowest keys: letters with enough attempts", () => {
    const s = slowestKeys([
      { char: "z", attempts: 40, errors: 0, ewmaErrorRate: 0, ewmaLatencyMs: 400 },
      { char: "q", attempts: 3, errors: 0, ewmaErrorRate: 0, ewmaLatencyMs: 900 },
      { char: ",", attempts: 40, errors: 0, ewmaErrorRate: 0, ewmaLatencyMs: 800 },
      { char: "e", attempts: 400, errors: 0, ewmaErrorRate: 0, ewmaLatencyMs: 150 },
    ]);
    expect(s.map((k) => k.char)).toEqual(["z", "e"]);
  });
});
