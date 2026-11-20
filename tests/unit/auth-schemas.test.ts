import { describe, expect, it } from "vitest";
import {
  loginSchema,
  mapAuthError,
  registerSchema,
  safeNextPath,
  toFieldErrors,
} from "@/features/auth/schemas";

const validRegistration = {
  email: "  Alice@Example.COM ",
  password: "correct-horse-battery",
  displayName: "Alice",
  ageBracket: "18_plus",
  acceptTerms: "on",
  locale: "fr",
};

describe("registerSchema", () => {
  it("accepts a valid registration and normalises the email", () => {
    const result = registerSchema.parse(validRegistration);
    expect(result.email).toBe("alice@example.com");
    expect(result.displayName).toBe("Alice");
  });

  it("turns an empty display name into undefined", () => {
    expect(registerSchema.parse({ ...validRegistration, displayName: "   " }).displayName).toBeUndefined();
  });

  it.each([
    ["email", "not-an-email", "invalidEmail"],
    ["password", "short", "passwordTooShort"],
    ["password", "x".repeat(73), "passwordTooLong"],
    ["displayName", "x".repeat(61), "displayNameTooLong"],
    ["ageBracket", "under_14", "ageRequired"],
  ])("rejects invalid %s with key %s", (field, value, key) => {
    const result = registerSchema.safeParse({ ...validRegistration, [field]: value });
    expect(result.success).toBe(false);
    if (!result.success) expect(toFieldErrors(result.error)[field]).toBe(key);
  });

  it("requires accepting the terms", () => {
    const result = registerSchema.safeParse({ ...validRegistration, acceptTerms: undefined });
    expect(result.success).toBe(false);
    if (!result.success) expect(toFieldErrors(result.error).acceptTerms).toBe("termsRequired");
  });

  it("rejects an unsupported locale", () => {
    expect(registerSchema.safeParse({ ...validRegistration, locale: "de" }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("does not apply the signup length rule to existing passwords", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "abc", locale: "en" }).success).toBe(true);
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/fr/app", "/fr/app"],
    ["/en/app/analytics?x=1", "/en/app/analytics?x=1"],
    [undefined, "/fallback"],
    ["", "/fallback"],
    ["https://evil.com", "/fallback"],
    ["//evil.com", "/fallback"],
    ["/\\evil.com", "/fallback"],
    ["javascript:alert(1)", "/fallback"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input, "/fallback")).toBe(expected);
  });
});

describe("mapAuthError", () => {
  it("maps known Supabase codes and falls back to generic", () => {
    expect(mapAuthError("invalid_credentials")).toBe("invalidCredentials");
    expect(mapAuthError("over_email_send_rate_limit")).toBe("rateLimited");
    expect(mapAuthError("something_new")).toBe("generic");
    expect(mapAuthError(undefined)).toBe("generic");
  });
});
