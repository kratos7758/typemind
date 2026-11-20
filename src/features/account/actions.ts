"use server";

import { redirect } from "next/navigation";
import { getClaims } from "@/features/auth/dal";
import { cancelSubscriptionNow } from "@/features/billing/checkout";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { defaultLocale, isLocale } from "@/i18n/config";

export type DeleteState = { status: "idle" | "mismatch" | "error" };

/**
 * Permanently deletes the account (right to erasure). The user must retype their email.
 * Order: cancel Stripe (stop future charges) → delete the auth user (all rows cascade) → sign out.
 */
export async function deleteAccountAction(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  const claims = await getClaims();
  const locale = isLocale(formData.get("locale")) ? (formData.get("locale") as "fr" | "en") : defaultLocale;
  if (!claims) redirect(`/${locale}/login`);

  const typed = String(formData.get("confirmEmail") ?? "").trim().toLowerCase();
  const email = typeof claims.email === "string" ? claims.email.toLowerCase() : null;
  if (!email || typed !== email) return { status: "mismatch" };

  try {
    await cancelSubscriptionNow(claims.sub);
    const { error } = await supabaseAdmin().auth.admin.deleteUser(claims.sub);
    if (error) throw error;
  } catch (error) {
    console.error("account deletion failed", error instanceof Error ? error.message : error);
    return { status: "error" };
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  redirect(`/${locale}`);
}
