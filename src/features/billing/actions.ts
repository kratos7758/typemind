"use server";

import { redirect } from "next/navigation";
import { getClaims, isGuest } from "@/features/auth/dal";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { createCheckout, createPortal } from "./checkout";
import { isPaidPlan } from "./plans";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";

export type BillingActionState = {
  status: "idle" | "unavailable" | "already_subscribed" | "price_missing" | "account_required" | "error";
};

const localeOf = (formData: FormData): Locale => {
  const v = formData.get("locale");
  return isLocale(v) ? v : defaultLocale;
};

/** Starts Stripe Checkout for the plan in the form. The user comes from the verified session. */
export async function checkoutAction(_prev: BillingActionState, formData: FormData): Promise<BillingActionState> {
  const locale = localeOf(formData);
  const claims = await getClaims();
  if (!claims) redirect(`/${locale}/login`);
  // A subscription needs an email (receipts, portal, recovery): guests register first.
  if (isGuest(claims)) return { status: "account_required" };
  if (!(await rateLimit(RATE_LIMITS.billing, claims.sub)).allowed) return { status: "error" };
  const plan = formData.get("plan");
  if (!isPaidPlan(plan)) return { status: "error" };

  let url: string;
  try {
    const outcome = await createCheckout(claims.sub, typeof claims.email === "string" ? claims.email : undefined, plan, locale);
    if (outcome.status !== "redirect") return { status: outcome.status };
    url = outcome.url;
  } catch (error) {
    console.error("checkout failed", error instanceof Error ? error.message : error);
    return { status: "error" };
  }
  redirect(url);
}

export async function portalAction(_prev: BillingActionState, formData: FormData): Promise<BillingActionState> {
  const locale = localeOf(formData);
  const claims = await getClaims();
  if (!claims) redirect(`/${locale}/login`);
  if (!(await rateLimit(RATE_LIMITS.billing, claims.sub)).allowed) return { status: "error" };

  let url: string;
  try {
    const outcome = await createPortal(claims.sub, locale);
    if (outcome.status !== "redirect") return { status: outcome.status };
    url = outcome.url;
  } catch (error) {
    console.error("portal failed", error instanceof Error ? error.message : error);
    return { status: "error" };
  }
  redirect(url);
}
