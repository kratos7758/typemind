import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { exportUserData } from "@/features/account/data";
import type { JwtClaims } from "@/lib/db/client";
import { RATE_LIMITS, rateLimit, tooManyRequests } from "@/lib/rate-limit";

/** Downloads all of the signed-in user's data as JSON. */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const limit = await rateLimit(RATE_LIMITS.accountExport, data.claims.sub);
  if (!limit.allowed) return tooManyRequests(limit);

  const payload = await exportUserData(data.claims as JwtClaims);
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="typemind-export-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
