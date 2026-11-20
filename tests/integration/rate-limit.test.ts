import { describe, expect, it } from "vitest";
import { rateLimit, windowStart } from "@/lib/rate-limit";

const rule = (limit: number) => ({ name: `test-${crypto.randomUUID()}`, limit, windowSeconds: 60 });

describe("rateLimit (Postgres fixed window)", () => {
  it("aligns windows", () => {
    expect(windowStart(new Date("2026-11-19T10:00:59.999Z"), 60).toISOString()).toBe("2026-11-19T10:00:00.000Z");
    expect(windowStart(new Date("2026-11-19T10:59:00Z"), 3600).toISOString()).toBe("2026-11-19T10:00:00.000Z");
  });

  it("allows up to the limit then refuses, with Retry-After", async () => {
    const r = rule(3);
    const now = new Date("2026-11-19T10:00:15Z");
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await rateLimit(r, "user-a", now));
    expect(results.map((x) => x.allowed)).toEqual([true, true, true, false]);
    expect(results[3].retryAfterSeconds).toBe(45);
    expect(results[2].remaining).toBe(0);
  });

  it("is per subject and per window", async () => {
    const r = rule(1);
    const t = new Date("2026-11-19T10:00:00Z");
    expect((await rateLimit(r, "a", t)).allowed).toBe(true);
    expect((await rateLimit(r, "b", t)).allowed).toBe(true);
    expect((await rateLimit(r, "a", t)).allowed).toBe(false);
    expect((await rateLimit(r, "a", new Date("2026-11-19T10:01:00Z"))).allowed).toBe(true);
  });

  it("stays exact under concurrency", async () => {
    const r = rule(5);
    const now = new Date();
    const results = await Promise.all(Array.from({ length: 20 }, () => rateLimit(r, "burst", now)));
    expect(results.filter((x) => x.allowed)).toHaveLength(5);
  });
});
