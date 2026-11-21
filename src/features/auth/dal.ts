import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { JwtClaims } from "@/lib/db/client";
import type { Locale } from "@/i18n/config";

/**
 * Data Access Layer for the session. Every protected read/mutation goes through here.
 * Uses getClaims(), which verifies the JWT (unlike getSession()).
 */
export async function getClaims(): Promise<JwtClaims | null> {
  // Session validation compares the JWT expiry with the current time: request-time only.
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return data.claims as JwtClaims;
}

/**
 * Guest = Supabase anonymous user (ADR-027): can practise and keep progress in this
 * browser, but has no email. Features that cost money or need an address stay locked.
 */
export function isGuest(claims: JwtClaims): boolean {
  return claims.is_anonymous === true;
}

export async function requireClaims(locale: Locale): Promise<JwtClaims> {
  const claims = await getClaims();
  if (!claims) redirect(`/${locale}/login`);
  return claims;
}
