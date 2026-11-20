import { z } from "zod";
import { locales } from "@/i18n/config";

/**
 * Form schemas. Error messages are dictionary keys under `auth.errors`,
 * translated by the UI — keeps validation logic locale-independent and testable.
 */
export type AuthErrorKey =
  | "invalidEmail"
  | "passwordTooShort"
  | "passwordTooLong"
  | "displayNameTooLong"
  | "ageRequired"
  | "termsRequired"
  | "invalidCredentials"
  | "emailNotConfirmed"
  | "rateLimited"
  | "weakPassword"
  | "linkInvalid"
  | "generic";

const email = z.string().trim().toLowerCase().pipe(z.email({ error: "invalidEmail" }));
const password = z
  .string()
  .min(10, { error: "passwordTooShort" })
  .max(72, { error: "passwordTooLong" }); // bcrypt limit used by Supabase Auth

const locale = z.enum(locales);

export const loginSchema = z.object({
  email,
  password: z.string().min(1, { error: "passwordTooShort" }).max(72, { error: "passwordTooLong" }),
  locale,
  next: z.string().optional(),
});

export const registerSchema = z.object({
  email,
  password,
  displayName: z
    .string()
    .trim()
    .max(60, { error: "displayNameTooLong" })
    .optional()
    .transform((v) => (v ? v : undefined)),
  ageBracket: z.enum(["14_17", "18_plus"], { error: "ageRequired" }),
  acceptTerms: z.literal("on", { error: "termsRequired" }),
  locale,
});

export const forgotPasswordSchema = z.object({ email, locale });

export const resetPasswordSchema = z.object({ password, locale });

export type FieldErrors = Partial<Record<string, AuthErrorKey>>;

/** Flattens Zod issues to { field: errorKey } (first issue per field). */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    out[field] ??= (issue.message as AuthErrorKey) ?? "generic";
  }
  return out;
}

/**
 * Only allow same-site relative redirects after login (prevents open redirects
 * such as `?next=//evil.com` or `?next=https://evil.com`).
 */
export function safeNextPath(next: string | undefined | null, fallback: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}

/** Maps Supabase Auth error codes to our dictionary keys. */
export function mapAuthError(code: string | undefined): AuthErrorKey {
  switch (code) {
    case "invalid_credentials":
      return "invalidCredentials";
    case "email_not_confirmed":
      return "emailNotConfirmed";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "rateLimited";
    case "weak_password":
      return "weakPassword";
    default:
      return "generic";
  }
}
