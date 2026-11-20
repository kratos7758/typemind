"use client";

import type { SessionPayload } from "./schema";
import type { RecordResult } from "./record";

/**
 * Sends a session to the server. If the network or server fails, the payload is
 * kept in localStorage and retried later (idempotent thanks to clientSessionId),
 * so a completed session is never lost (PRD acceptance criterion #6).
 */
const QUEUE_KEY = "typemind:pending-sessions";
const MAX_QUEUE = 30;

export type SaveOutcome =
  | { status: "saved"; result: RecordResult }
  | { status: "queued" }
  | { status: "rejected"; reason: string }
  | { status: "unauthenticated" };

function readQueue(): SessionPayload[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as SessionPayload[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: SessionPayload[]) {
  try {
    if (queue.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
    else localStorage.removeItem(QUEUE_KEY);
  } catch {
    // Storage unavailable (private mode): nothing more we can do offline.
  }
}

const enqueue = (p: SessionPayload) =>
  writeQueue([...readQueue().filter((q) => q.clientSessionId !== p.clientSessionId), p]);

async function post(payload: SessionPayload): Promise<SaveOutcome | "retry"> {
  let response: Response;
  try {
    response = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    return "retry";
  }
  if (response.ok) return { status: "saved", result: (await response.json()) as RecordResult };
  if (response.status === 401) return { status: "unauthenticated" };
  if (response.status >= 500 || response.status === 429) return "retry";
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return { status: "rejected", reason: body.error ?? `http_${response.status}` };
}

export async function saveSession(payload: SessionPayload): Promise<SaveOutcome> {
  const outcome = await post(payload);
  if (outcome === "retry" || outcome.status === "unauthenticated") {
    enqueue(payload);
    return outcome === "retry" ? { status: "queued" } : outcome;
  }
  return outcome;
}

/** Retries queued sessions; returns how many were saved. */
export async function flushPendingSessions(): Promise<number> {
  const queue = readQueue();
  if (!queue.length) return 0;
  const remaining: SessionPayload[] = [];
  let saved = 0;
  for (const payload of queue) {
    const outcome = await post(payload);
    if (outcome === "retry" || outcome.status === "unauthenticated") remaining.push(payload);
    else if (outcome.status === "saved") saved++;
    // "rejected" payloads are dropped: they would never be accepted.
  }
  writeQueue(remaining);
  return saved;
}

export const pendingSessionCount = () => readQueue().length;
