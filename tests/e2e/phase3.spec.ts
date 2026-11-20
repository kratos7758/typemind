/**
 * Phase 3 journeys. History is seeded through the real /api/sessions endpoint with
 * summaries produced by the real typing engine (fake clock, deliberate errors on "r").
 */
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { TypingEngine } from "../../src/features/typing-engine/engine";
import { summarize } from "../../src/features/typing-engine/stats";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .map((l) => /^([A-Z0-9_]+)=(.*)$/.exec(l))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => [m[1], m[2]]),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const password = "phase3-e2e-password";
let email: string;
let userId: string;

const TEXT =
  "le renard rapide traverse la rivière en courant vers la forêt pour retrouver ses frères avant la tombée de la nuit";

/** Types TEXT at `msPerChar`, hitting "t" instead of the first `rErrors` letters "r" (then correcting). */
function payload(msPerChar: number, rErrors: number, endedAt: Date) {
  let now = 0;
  const engine = new TypingEngine(TEXT, { now: () => now });
  let errorsLeft = rErrors;
  for (const ch of Array.from(TEXT)) {
    if (ch === "r" && errorsLeft > 0) {
      errorsLeft--;
      engine.insert("t");
      now += msPerChar;
      engine.deleteBackward();
    }
    engine.insert(ch);
    now += msPerChar;
  }
  const summary = summarize(engine.result());
  return {
    clientSessionId: crypto.randomUUID(),
    mode: "speed_test",
    exerciseKey: "speed:60",
    layoutId: "fr-azerty",
    timeZone: "America/Toronto",
    startedAt: new Date(endedAt.getTime() - summary.durationMs - 2000).toISOString(),
    endedAt: endedAt.toISOString(),
    completed: true,
    summary,
  };
}

async function login(page: Page) {
  await page.goto("/fr/login");
  await page.getByLabel("Adresse courriel").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL(/\/fr\/(app|onboarding)/, { timeout: 60_000 });
}

async function seed(request: APIRequestContext) {
  const day = 24 * 3600_000;
  // One old session (10 days ago) that the Free plan must NOT show.
  const old = await request.post("/api/sessions", { data: payload(300, 0, new Date(Date.now() - 10 * day)) });
  expect(old.status()).toBe(201);
  // 12 recent sessions over 4 days, getting faster, always struggling with "r".
  for (let i = 0; i < 12; i++) {
    const endedAt = new Date(Date.now() - (3 - Math.floor(i / 3)) * day - (12 - i) * 60_000);
    const res = await request.post("/api/sessions", { data: payload(260 - i * 8, 4, endedAt) });
    expect(res.status()).toBe(201);
  }
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  email = `p3-${Date.now()}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "Noa", age_bracket: "18_plus", locale: "fr" },
  });
  if (error) throw error;
  userId = data.user!.id;
  // Skip onboarding: preferences + level set directly (onboarding has its own E2E test).
  await admin.from("profiles").update({ onboarding_completed_at: new Date().toISOString() }).eq("id", userId);
  await admin.from("user_preferences").update({ keyboard_layout_id: "fr-azerty", experience_level: "intermediate" }).eq("user_id", userId);
  await admin.from("user_interests").insert({ user_id: userId, topic_key: "science" });
  await admin.from("learning_profiles").update({ skill_level: "intermediate", assessed_at: new Date().toISOString() }).eq("user_id", userId);
});

test.afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId);
});

test("weak keys drive the recommendation, the adaptive drill and analytics", async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);
  await seed(page.request);

  // Dashboard: targeted exercise, explained with the measured weak key.
  await page.goto("/fr/app");
  await expect(page.getByText("Exercice ciblé sur tes touches difficiles")).toBeVisible();
  await expect(page.getByTestId("recommendation-reason")).toContainText("r");
  await expect(page.getByText(/Tendance : en progression/)).toBeVisible();

  // Adaptive drill targets r.
  await page.getByRole("link", { name: "Commencer l'entraînement du jour" }).click();
  await expect(page).toHaveURL(/\/practice\/adaptive\/weak$/);
  await expect(page.getByText(/^Cibles : .*r/)).toBeVisible();
  const drill = (await page.getByTestId("typing-text").getAttribute("data-text")) ?? "";
  const words = drill.split(" ");
  expect(words.filter((w) => w.includes("r")).length / words.length).toBeGreaterThan(0.5);

  // Analytics: Free plan window, charts, heatmap readout on "r".
  await page.goto("/fr/app/analytics");
  await expect(page.getByText("Formule gratuite : historique des 7 derniers jours.")).toBeVisible();
  await expect(page.getByText("Vitesse nette par jour (MPM, moyenne)")).toBeVisible();
  await expect(page.getByText("Précision par jour (%, moyenne)")).toBeVisible();
  // 12 recent sessions only: the 10-day-old one is outside the Free window.
  await expect(page.locator("dt", { hasText: "Séances" }).locator("+ dd")).toHaveText("12");
  const rKey = page.getByRole("button", { name: /^r : .* d’erreurs · .* essais$/ });
  await rKey.focus();
  await expect(page.locator("p[aria-live=polite]", { hasText: /^r : / })).toBeVisible();
  // Chart keyboard navigation shows a tooltip.
  await page.getByRole("img", { name: /Vitesse nette par jour/ }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("div[role=status]").first()).toBeVisible();
});

test("AI card is honest when no provider is configured", async ({ page }) => {
  await login(page);
  await page.goto("/fr/app/practice");
  await expect(page.getByText(/La génération par IA n.est pas encore activée/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Générer le texte" })).toBeDisabled();
  await page.getByRole("link", { name: "Ouvrir un texte de la bibliothèque" }).click();
  await expect(page).toHaveURL(/\/practice\/text\/fr-science-1$/);
});

test("preferences are saved and reflected on the dashboard", async ({ page }) => {
  await login(page);
  await page.goto("/fr/app/settings");
  await page.getByLabel("Combien de temps par jour ?").selectOption("20");
  await page.getByLabel("Objectif de vitesse (MPM)").fill("65");
  await page.getByLabel("Cuisine").check();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Préférences enregistrées.")).toBeVisible();

  await page.goto("/fr/app");
  await expect(page.getByText(/\/ 20 min/)).toBeVisible();
  await expect(page.getByText(/Objectif : 65/)).toBeVisible();
});
