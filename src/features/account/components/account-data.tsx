"use client";

import { useActionState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Alert, Field, Input } from "@/components/ui/field";
import { format } from "@/lib/utils";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { deleteAccountAction, type DeleteState } from "../actions";

export function AccountData({ locale, email, t }: { locale: Locale; email: string; t: Dictionary["account"] }) {
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteAccountAction, { status: "idle" });

  return (
    <section className="flex max-w-3xl flex-col gap-8 border-t border-border pt-6">
      <h2 className="font-semibold">{t.title}</h2>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">{t.exportTitle}</h3>
        <p className="text-sm text-fg-muted">{t.exportHint}</p>
        <div>
          {/* Plain link: a file download, not a client-side navigation. */}
          <a href="/api/account/export" download className={buttonVariants({ variant: "secondary" })}>
            {t.exportCta}
          </a>
        </div>
      </div>

      <form action={action} className="flex flex-col gap-3 rounded-md border border-danger/40 p-5">
        <input type="hidden" name="locale" value={locale} />
        <h3 className="text-sm font-medium text-danger">{t.deleteTitle}</h3>
        <p className="text-sm text-fg-muted">{t.deleteHint}</p>
        <Field
          id="confirmEmail"
          label={format(t.deleteConfirm, { email })}
          error={state.status === "mismatch" ? t.deleteMismatch : undefined}
        >
          {(aria) => <Input {...aria} name="confirmEmail" type="email" autoComplete="off" className="max-w-sm" required />}
        </Field>
        {state.status === "error" ? <Alert>{t.deleteError}</Alert> : null}
        <div>
          <Button type="submit" variant="secondary" disabled={pending} className="border-danger text-danger hover:bg-danger-soft">
            {t.deleteCta}
          </Button>
        </div>
      </form>
    </section>
  );
}
