"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input } from "@/components/ui/field";
import { format } from "@/lib/utils";
import {
  forgotPasswordAction,
  loginAction,
  registerAction,
  resetPasswordAction,
  startGuestAction,
  type AuthFormState,
} from "../actions";
import type { AuthErrorKey } from "../schemas";

type AuthDict = Dictionary["auth"];
type Props = { locale: Locale; t: AuthDict };

const initial: AuthFormState = { status: "idle" };

const errorText = (t: AuthDict, key: AuthErrorKey | undefined) => (key ? t.errors[key] : undefined);

function useForm(action: typeof loginAction) {
  const [state, formAction, pending] = useActionState(action, initial);
  const fieldError = (t: AuthDict, name: string) =>
    state.status === "error" ? errorText(t, state.fieldErrors?.[name]) : undefined;
  const value = (name: string) => (state.status === "error" ? state.values?.[name] : undefined);
  return { state, formAction, pending, fieldError, value };
}

export function LoginForm({ locale, t, next, linkError }: Props & { next?: string; linkError?: boolean }) {
  const { state, formAction, pending, fieldError, value } = useForm(loginAction);
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {linkError && state.status === "idle" ? <Alert>{t.errors.linkInvalid}</Alert> : null}
      {state.status === "error" && state.formError ? <Alert>{t.errors[state.formError]}</Alert> : null}
      <Field id="email" label={t.email} error={fieldError(t, "email")}>
        {(aria) => (
          <Input {...aria} name="email" type="email" autoComplete="email" required defaultValue={value("email")} />
        )}
      </Field>
      <Field id="password" label={t.password} error={fieldError(t, "password")}>
        {(aria) => <Input {...aria} name="password" type="password" autoComplete="current-password" required />}
      </Field>
      <Button type="submit" disabled={pending} className="mt-2">
        {t.login.submit}
      </Button>
      <Link href={`/${locale}/forgot-password`} className="text-sm text-fg-muted hover:text-fg">
        {t.login.forgot}
      </Link>
    </form>
  );
}

export function RegisterForm({ locale, t, legal }: Props & { legal: { terms: string; privacy: string } }) {
  const { state, formAction, pending, fieldError, value } = useForm(registerAction);

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-3" role="status">
        <h2 className="text-xl font-semibold">{t.register.checkEmailTitle}</h2>
        <p className="text-fg-muted">{format(t.register.checkEmailBody, { email: state.email ?? "" })}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {state.status === "error" && state.formError ? <Alert>{t.errors[state.formError]}</Alert> : null}
      <Field id="email" label={t.email} error={fieldError(t, "email")}>
        {(aria) => (
          <Input {...aria} name="email" type="email" autoComplete="email" required defaultValue={value("email")} />
        )}
      </Field>
      <Field id="password" label={t.password} hint={t.passwordHint} error={fieldError(t, "password")}>
        {(aria) => (
          <Input {...aria} name="password" type="password" autoComplete="new-password" minLength={10} required />
        )}
      </Field>
      <Field id="displayName" label={t.displayName} error={fieldError(t, "displayName")}>
        {(aria) => (
          <Input {...aria} name="displayName" autoComplete="nickname" maxLength={60} defaultValue={value("displayName")} />
        )}
      </Field>

      <fieldset className="flex flex-col gap-2" aria-describedby="age-notice">
        <legend className="mb-1 text-sm font-medium">{t.ageBracket}</legend>
        {(["14_17", "18_plus"] as const).map((bracket) => (
          <label key={bracket} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="ageBracket"
              value={bracket}
              defaultChecked={value("ageBracket") === bracket}
              className="accent-[var(--accent)]"
            />
            {t[`age_${bracket}`]}
          </label>
        ))}
        {fieldError(t, "ageBracket") ? (
          <p className="text-sm text-danger">{fieldError(t, "ageBracket")}</p>
        ) : (
          <p id="age-notice" className="text-xs text-fg-muted">
            {t.ageNotice}
          </p>
        )}
      </fieldset>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="acceptTerms" className="mt-0.5 accent-[var(--accent)]" />
        <span>
          {t.acceptTerms}{" "}
          <Link href={`/${locale}/terms`} target="_blank" className="underline">
            {legal.terms}
          </Link>{" "}
          ·{" "}
          <Link href={`/${locale}/privacy`} target="_blank" className="underline">
            {legal.privacy}
          </Link>
        </span>
      </label>
      {fieldError(t, "acceptTerms") ? <p className="text-sm text-danger">{fieldError(t, "acceptTerms")}</p> : null}

      <Button type="submit" disabled={pending} className="mt-2">
        {t.register.submit}
      </Button>
    </form>
  );
}

/** "Start for free" button: creates a guest session, no form to fill. */
export function GuestStartForm({
  locale,
  t,
  label,
  notice,
  size = "lg",
  variant = "primary",
}: Props & { label: string; notice?: React.ReactNode; size?: "sm" | "md" | "lg"; variant?: "primary" | "secondary" }) {
  const [state, formAction, pending] = useActionState(startGuestAction, initial);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="locale" value={locale} />
      <Button type="submit" size={size} variant={variant} disabled={pending} className="self-start">
        {label}
      </Button>
      {notice}
      {state.status === "error" && state.formError ? <Alert>{t.errors[state.formError]}</Alert> : null}
    </form>
  );
}

export function ForgotPasswordForm({ locale, t }: Props) {
  const { state, formAction, pending, fieldError, value } = useForm(forgotPasswordAction);
  if (state.status === "success") {
    return <Alert tone="info">{t.forgot.sent}</Alert>;
  }
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {state.status === "error" && state.formError ? <Alert>{t.errors[state.formError]}</Alert> : null}
      <Field id="email" label={t.email} error={fieldError(t, "email")}>
        {(aria) => (
          <Input {...aria} name="email" type="email" autoComplete="email" required defaultValue={value("email")} />
        )}
      </Field>
      <Button type="submit" disabled={pending}>
        {t.forgot.submit}
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ locale, t }: Props) {
  const { state, formAction, pending, fieldError } = useForm(resetPasswordAction);
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {state.status === "error" && state.formError ? <Alert>{t.errors[state.formError]}</Alert> : null}
      <Field id="password" label={t.password} hint={t.passwordHint} error={fieldError(t, "password")}>
        {(aria) => (
          <Input {...aria} name="password" type="password" autoComplete="new-password" minLength={10} required />
        )}
      </Field>
      <Button type="submit" disabled={pending}>
        {t.reset.submit}
      </Button>
    </form>
  );
}
