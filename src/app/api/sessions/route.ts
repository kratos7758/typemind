import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sessionPayloadSchema } from "@/features/sessions/schema";
import { recordSession } from "@/features/sessions/record";
import { RATE_LIMITS, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const MAX_BODY_BYTES = 256 * 1024;

/** Saves a completed typing session. Auth: Supabase session cookie (verified JWT). */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const limit = await rateLimit(RATE_LIMITS.sessions, userId);
  if (!limit.allowed) return tooManyRequests(limit);

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = sessionPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.issues.slice(0, 5).map((i) => i.message) },
      { status: 422 },
    );
  }

  try {
    const result = await recordSession(userId, parsed.data);
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    console.error("recordSession failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
