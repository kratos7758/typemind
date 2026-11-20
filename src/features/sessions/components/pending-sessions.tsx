"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "@/lib/utils";
import { flushPendingSessions, pendingSessionCount } from "../client";

/** Retries sessions saved offline, on load and whenever the browser comes back online. */
export function PendingSessions({ label }: { label: string }) {
  const router = useRouter();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const flush = async () => {
      setCount(pendingSessionCount());
      const saved = await flushPendingSessions();
      setCount(pendingSessionCount());
      if (saved > 0) router.refresh();
    };
    void flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [router]);

  if (!count) return null;
  return (
    <p role="status" className="bg-accent-soft px-4 py-2 text-center text-sm">
      {format(label, { n: count })}
    </p>
  );
}
