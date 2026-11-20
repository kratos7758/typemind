import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

export const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .map((l) => /^([A-Z0-9_]+)=(.*)$/.exec(l))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => [m[1], m[2]]),
);

export const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

export const PASSWORD = "e2e-shared-password";

/** Creates a confirmed, onboarded user (AZERTY, French content, interested in science). */
export async function createOnboardedUser(label: string) {
  const email = `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: label, age_bracket: "18_plus", locale: "fr" },
  });
  if (error) throw error;
  const id = data.user!.id;
  await admin.from("profiles").update({ onboarding_completed_at: new Date().toISOString() }).eq("id", id);
  await admin.from("user_preferences").update({ keyboard_layout_id: "fr-azerty", experience_level: "intermediate" }).eq("user_id", id);
  await admin.from("user_interests").insert({ user_id: id, topic_key: "science" });
  return { email, id };
}

export async function login(page: Page, email: string) {
  await page.goto("/fr/login");
  await page.getByLabel("Adresse courriel").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL(/\/fr\/(app|onboarding)/, { timeout: 60_000 });
}

/** Text the user must type, with typographic characters mapped to their keyboard form. */
export async function exerciseText(page: Page): Promise<string> {
  const raw = (await page.getByTestId("typing-text").getAttribute("data-text")) ?? "";
  return raw.replace(/[’‘]/g, "'").replace(/[  ]/g, " ");
}

/**
 * The Studio focuses its input on load. A browser window that is not active (WebKit
 * running several tests in parallel) may refuse programmatic focus: the UI then shows
 * "click here to start", so we click like a real user would.
 */
export async function expectFocusedInput(page: Page) {
  const input = page.getByTestId("typing-input");
  await page.getByTestId("typing-text").waitFor();
  try {
    await expect(input).toBeFocused({ timeout: 3_000 });
  } catch {
    await page.getByTestId("typing-text").click();
    await expect(input).toBeFocused();
  }
}
