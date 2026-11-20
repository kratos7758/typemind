import { describe, expect, it } from "vitest";
import { ACCESS_STATUSES, lookupKey, mapStatus, monthlyCents, planFromLookupKey } from "@/features/billing/plans";

describe("billing plans", () => {
  it("round-trips lookup keys and rejects unknown ones", () => {
    expect(planFromLookupKey(lookupKey("pro_yearly"))).toBe("pro_yearly");
    expect(planFromLookupKey("typemind_enterprise")).toBeNull();
    expect(planFromLookupKey("other_pro_monthly")).toBeNull();
    expect(planFromLookupKey(null)).toBeNull();
  });

  it("maps Stripe statuses, unknown ones to no access", () => {
    expect(mapStatus("incomplete_expired")).toBe("canceled");
    expect(mapStatus("past_due")).toBe("past_due");
    expect(mapStatus("something_new" as never)).toBe("unpaid");
  });

  it("grants access while active, trialing or past due only", () => {
    expect([...ACCESS_STATUSES].sort()).toEqual(["active", "past_due", "trialing"]);
  });

  it("normalizes yearly prices to monthly revenue", () => {
    expect(monthlyCents(999, "month")).toBe(999);
    expect(monthlyCents(7999, "year")).toBe(667);
    expect(monthlyCents(0, null)).toBe(0);
  });
});
