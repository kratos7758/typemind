/**
 * Core learning journey in a real browser:
 * onboarding → placement test → saved results → dashboard → lesson with a dead key → offline save.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .map((l) => /^([A-Z0-9_]+)=(.*)$/.exec(l))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => [m[1], m[2]]),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const password = "learning-e2e-password";
let email: string;
let userId: string;

test.beforeAll(async () => {
  email = `learn-${Date.now()}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "Léa", age_bracket: "18_plus", locale: "fr" },
  });
  if (error) throw error;
  userId = data.user!.id;
});

test.afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId);
});

async function login(page: Page) {
  await page.goto("/fr/login");
  await page.getByLabel("Adresse courriel").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  // First visit compiles the destination route in dev mode: allow time.
  await page.waitForURL(/\/fr\/(app|onboarding)/, { timeout: 60_000 });
}

/** Text the user must type, with typographic characters mapped to their keyboard form. */
async function exerciseText(page: Page): Promise<string> {
  const raw = (await page.getByTestId("typing-text").getAttribute("data-text")) ?? "";
  return raw.replace(/[’‘]/g, "'").replace(/[  ]/g, " ");
}

test.describe.configure({ mode: "serial" });

test("onboarding → placement test → dashboard", async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);
  // /app → /onboarding redirect happens in streamed content; slow on first dev compile.
  await expect(page).toHaveURL(/\/fr\/onboarding$/, { timeout: 30_000 });

  // 1 language, 2 layout, 3 experience, 4 goals, 5 interests, 6 daily goal
  await page.getByRole("radio", { name: "Français" }).click();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("radio", { name: "Français — AZERTY" }).click();
  await page.getByRole("button", { name: "Continuer" }).click();
  const next = page.getByRole("button", { name: "Continuer" });
  await expect(next).toBeDisabled(); // experience is required
  await page.getByRole("radio", { name: /Je tape sans trop regarder/ }).click();
  await next.click();
  await page.getByRole("checkbox", { name: "Taper plus vite" }).click();
  await next.click();
  await expect(next).toBeDisabled(); // at least one interest
  await page.getByRole("checkbox", { name: "Sciences" }).click();
  await page.getByRole("checkbox", { name: "Finance" }).click();
  await next.click();
  await page.getByRole("radio", { name: "15 min" }).click();
  await page.getByRole("button", { name: "Terminer et passer le test" }).click();

  // Placement test.
  // Server action + redirect; slower when the suite runs several workers in parallel.
  await expect(page).toHaveURL(/\/fr\/app\/practice\/assessment\/fr$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Test de niveau" })).toBeVisible();
  const input = page.getByTestId("typing-input");
  await expect(input).toBeFocused();
  const text = await exerciseText(page);
  expect(text).toContain("Apprendre à taper");

  // ~200 WPM-equivalent pace is fine for the server's plausibility check (≤ 25 keys/s).
  await page.keyboard.type(text, { delay: 60 });

  await expect(page.getByRole("heading", { name: "Résultats" })).toBeVisible();
  await expect(page.getByTestId("save-status")).toHaveText("Séance enregistrée.", { timeout: 15_000 });
  await expect(page.getByText(/Ton niveau : /)).toBeVisible();

  // Dashboard shows the stored values.
  await page.getByRole("link", { name: "Tableau de bord" }).first().click();
  await expect(page).toHaveURL(/\/fr\/app$/);
  await expect(page.getByRole("heading", { name: "Bonjour Léa 👋" })).toBeVisible();
  await expect(page.getByText("Test de niveau").first()).toBeVisible(); // recent sessions
  await expect(page.getByText(/^Texte recommandé : /)).toBeVisible(); // intermediate → interest text
  await expect(page.getByText("1 j")).toBeVisible(); // streak
});

test("AZERTY lesson: dead key composition and accents", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  await page.goto("/fr/app/practice/lesson/special-letters");
  await expect(page.getByTestId("typing-input")).toBeFocused();

  // The first characters of the special-letters drill: é é é ... Type them normally.
  const text = await exerciseText(page);
  expect(text.length).toBeGreaterThan(20);

  // Simulate a dead-key composition (^ then e → ê) with Chromium's IME API on the first char,
  // which must be counted exactly once even though composition events fire several times.
  const cdp = await page.context().newCDPSession(page);
  const first = text[0];
  await cdp.send("Input.imeSetComposition", { text: "^", selectionStart: 1, selectionEnd: 1 });
  await cdp.send("Input.insertText", { text: first });
  await expect(page.getByTestId("live-accuracy")).toHaveText(/^100\s*%$/); // "100 %" in French (narrow no-break space)

  await page.keyboard.type(text.slice(1), { delay: 40 });
  await expect(page.getByRole("heading", { name: "Résultats" })).toBeVisible();
  await expect(page.getByText(/Leçon réussie/)).toBeVisible();
});

test("a session typed offline is queued and sent when back online", async ({ page, context }) => {
  test.setTimeout(120_000);
  await login(page);
  await page.goto("/fr/app/practice/text/fr-space-1");
  await expect(page.getByTestId("typing-input")).toBeFocused();
  const text = await exerciseText(page);

  await context.setOffline(true);
  await page.keyboard.type(text, { delay: 30 });
  await expect(page.getByTestId("save-status")).toContainText("Hors ligne", { timeout: 15_000 });

  await context.setOffline(false);
  await page.goto("/fr/app");
  // The flusher sends the queued session and refreshes the dashboard.
  await expect(page.getByText("Pratique adaptative").first()).toBeVisible({ timeout: 15_000 });
  const pending = await page.evaluate(() => localStorage.getItem("typemind:pending-sessions"));
  expect(pending).toBeNull();
});
