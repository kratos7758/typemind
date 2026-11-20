import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateExercise } from "@/features/ai/generate";
import { TOPICS } from "@/content/topics";
import { RATE_LIMITS, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const bodySchema = z.object({ topic: z.enum(TOPICS) });

/** Generates a personalized AI exercise for the signed-in user (quota enforced server-side). */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const limit = await rateLimit(RATE_LIMITS.aiExercise, userId);
  if (!limit.allowed) return tooManyRequests(limit);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_topic" }, { status: 422 });

  try {
    const outcome = await generateExercise(userId, parsed.data.topic);
    switch (outcome.status) {
      case "ok":
        return NextResponse.json(outcome, { status: 201 });
      case "unavailable":
        return NextResponse.json(outcome, { status: 503 });
      case "quota_exceeded":
        return NextResponse.json(outcome, { status: 429 });
      case "failed":
        return NextResponse.json(outcome, { status: 502 });
    }
  } catch (error) {
    console.error("generateExercise crashed", error instanceof Error ? error.message : error);
    return NextResponse.json({ status: "failed", reason: "server_error" }, { status: 500 });
  }
}
