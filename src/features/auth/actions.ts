"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { adminDb } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import {
  forgotPasswordSchema,
  loginSchema,
  mapAuthError,
  registerSchema,
  resetPasswordSchema,
  safeNextPath,
  toFieldErrors,
  type AuthErrorKey,
  type FieldErrors,
  type RegisterInput,
} from "./schemas";

export type AuthFormState =
  | { status: "idle" }
  | { status: "error"; fieldErrors?: FieldErrors; formError?: AuthErrorKey; values?: Record<string, string> }
  | { status: "success"; email?: string };

const formLocale = (formData: FormData): Locale => {
  const value = formData.get("locale");
  return isLocale(value) ? value : defaultLocale;
};

/** Echo back non-secret fields so the form keeps them after an error. */
const keep = (formData: FormData, fields: string[]) =>
  Object.fromEntries(fields.map((f) => [f, String(formData.get(f) ?? "")]));

/** Privileged read of a single flag for the user who just authenticated. */
async function isOnboarded(userId: string): Promise<boolean> {
  const [row] = await adminDb()
    .select({ at: profiles.onboardingCompletedAt })
    .from(profiles)
    .where(eq(profiles.id, userId));
  return Boolean(row?.at);
}

const confirmUrl = (next: string) =>
  `${env().NEXT_PUBLIC_SITE_URL}/auth/confirm?next=${encodeURIComponent(next)}`;

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", fieldErrors: toFieldErrors(parsed.error), values: keep(formData, ["email"]) };
  }
  const { email, password, locale, next } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { status: "error", formError: mapAuthError(error?.code), values: { email } };
  }
  // Send new users straight to onboarding. Redirecting to /app and letting the page
  // redirect again mid-stream leaves a stale redirect in the client router cache.
  const onboarded = await isOnboarded(data.user.id);
  redirect(onboarded ? safeNextPath(next, `/${locale}/app`) : `/${locale}/onboarding`);
}

export async function registerAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: toFieldErrors(parsed.error),
      values: keep(formData, ["email", "displayName", "ageBracket"]),
    };
  }
  const { email, password, displayName, ageBracket, locale } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data: current } = await supabase.auth.getClaims();
  if (current?.claims?.is_anonymous === true) {
    return convertGuest(current.claims.sub, formData, parsed.data);
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: confirmUrl(`/${locale}/onboarding`),
      // Read (and re-validated) by the handle_new_user trigger.
      data: { display_name: displayName ?? null, age_bracket: ageBracket, locale },
    },
  });
  if (error) {
    return {
      status: "error",
      formError: mapAuthError(error.code),
      values: keep(formData, ["email", "displayName", "ageBracket"]),
    };
  }
  // "Confirm email" disabled in Supabase: the user is signed in right away.
  if (data.session) redirect(`/${locale}/onboarding`);
  // Same response whether or not the address already exists (no account enumeration).
  return { status: "success", email };
}

/**
 * Turns the current guest into a regular account. Same user id, so every session,
 * statistic and preference is kept. Email + password must be sent together: Supabase
 * refuses a password on an anonymous user that has no email.
 */
async function convertGuest(
  userId: string,
  formData: FormData,
  { email, password, displayName, ageBracket, locale }: RegisterInput,
): Promise<AuthFormState> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.updateUser(
    { email, password, data: { display_name: displayName ?? null, age_bracket: ageBracket } },
    { emailRedirectTo: confirmUrl(`/${locale}/app`) },
  );
  if (error || !data.user) {
    return {
      status: "error",
      formError: mapAuthError(error?.code),
      values: keep(formData, ["email", "displayName", "ageBracket"]),
    };
  }
  // The signup trigger only runs on insert: copy what the registration form collected.
  await adminDb()
    .update(profiles)
    .set({ displayName: displayName ?? null, ageBracket })
    .where(eq(profiles.id, userId));

  // "Confirm email" off: the address is attached right away. Otherwise it waits for the link.
  if (data.user.email && !data.user.new_email) {
    await supabase.auth.refreshSession(); // new JWT without is_anonymous
    redirect(`/${locale}/app`);
  }
  return { status: "success", email };
}

/** "Start for free" without an account: anonymous Supabase user (ADR-027). */
export async function startGuestAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const locale = formLocale(formData);
  const supabase = await createSupabaseServerClient();
  const { data: current } = await supabase.auth.getClaims();
  if (current?.claims?.sub) redirect(`/${locale}/app`); // already signed in (guest or not)
  // Read by the handle_new_user trigger (interface and content language).
  const { error } = await supabase.auth.signInAnonymously({ options: { data: { locale } } });
  if (error) return { status: "error", formError: mapAuthError(error.code) };
  redirect(`/${locale}/onboarding`);
}

export async function forgotPasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", fieldErrors: toFieldErrors(parsed.error), values: keep(formData, ["email"]) };
  }
  const { email, locale } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: confirmUrl(`/${locale}/reset-password`),
  });
  if (error && mapAuthError(error.code) === "rateLimited") {
    return { status: "error", formError: "rateLimited", values: { email } };
  }
  // Never reveal whether the account exists.
  return { status: "success" };
}

export async function resetPasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return { status: "error", formError: "linkInvalid" };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: "error", formError: mapAuthError(error.code) };
  redirect(`/${parsed.data.locale}/app`);
}

export async function logoutAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(`/${formLocale(formData)}`);
}
