"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/field";
import { format } from "@/lib/utils";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { checkoutAction, portalAction, type BillingActionState } from "../actions";

type Labels = Dictionary["billing"];

function messageFor(state: BillingActionState, t: Labels) {
  switch (state.status) {
    case "unavailable":
      return t.unavailable;
    case "already_subscribed":
      return t.alreadySubscribed;
    case "price_missing":
      return t.priceMissing;
    case "account_required":
      return t.accountRequired;
    case "error":
      return t.error;
    default:
      return null;
  }
}

/** Subscribe buttons (Free users) or the Customer Portal button (paying users). */
export function BillingActions({
  locale,
  hasPaidPlan,
  hasCustomer,
  prices,
  t,
}: {
  locale: Locale;
  hasPaidPlan: boolean;
  hasCustomer: boolean;
  prices: { monthly: string | null; yearly: string | null };
  t: Labels;
}) {
  const [checkoutState, checkout, checkoutPending] = useActionState<BillingActionState, FormData>(checkoutAction, { status: "idle" });
  const [portalState, portal, portalPending] = useActionState<BillingActionState, FormData>(portalAction, { status: "idle" });
  const message = messageFor(checkoutState, t) ?? messageFor(portalState, t);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        {!hasPaidPlan ? (
          <>
            {prices.monthly ? (
              <form action={checkout}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="plan" value="pro_monthly" />
                <Button type="submit" disabled={checkoutPending}>
                  {format(t.subscribeMonthly, { price: prices.monthly })}
                </Button>
              </form>
            ) : null}
            {prices.yearly ? (
              <form action={checkout}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="plan" value="pro_yearly" />
                <Button type="submit" variant="secondary" disabled={checkoutPending}>
                  {format(t.subscribeYearly, { price: prices.yearly })}
                </Button>
              </form>
            ) : null}
          </>
        ) : null}
        {hasCustomer ? (
          <form action={portal}>
            <input type="hidden" name="locale" value={locale} />
            <Button type="submit" variant={hasPaidPlan ? "primary" : "ghost"} disabled={portalPending}>
              {t.manage}
            </Button>
          </form>
        ) : null}
      </div>
      {message ? <Alert tone={checkoutState.status === "error" || portalState.status === "error" ? "danger" : "info"}>{message}</Alert> : null}
      <p className="text-xs text-fg-muted">{t.securePayment}</p>
    </div>
  );
}
