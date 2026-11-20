"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { TypingEngine, type EngineOptions } from "./engine";

/**
 * Owns a TypingEngine and exposes its snapshot.
 * The engine is created once: to type a different text, remount the caller with a new `key`.
 * `restart()` creates a fresh engine for the same text and options.
 */
export function useTypingEngine(text: string, options: Omit<EngineOptions, "now"> = {}) {
  const [engine, setEngine] = useState(() => new TypingEngine(text, options));
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);

  // Timed exercises must end even if the user stops typing.
  useEffect(() => {
    if (snapshot.status !== "running") return;
    const id = window.setInterval(() => engine.tick(), 100);
    return () => window.clearInterval(id);
  }, [engine, snapshot.status]);

  const restart = useCallback(
    () => setEngine(new TypingEngine(text, options)),
    // Options are fixed for the lifetime of the component (see doc comment).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text],
  );

  return { engine, snapshot, restart };
}
