/**
 * Phase 4: pricing, billing (without a Stripe key: honest "not configured"),
 * signed webhooks through the real route, data export, account deletion, admin access.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { readFileSync } from "node:fs";
import { E2E_WEBHOOK_SECRET } from "../../playwright.config";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .map((l) => /^([A-Z0-9_]+)=(.*)$/.exec(l))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => [m[1], m[2]]),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const password = "phase4-e2e-password";

async function createUser(label: string) {
  const email = `p4-${label}-${Date.now()}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: label, age_bracket: "18_plus", locale: "fr" },
  });
  if (error) throw error;
  const id = data.user!.id;
  await admin.from("profiles").update({ onboarding_completed_at: new Date().toISOString() }).eq("id", id);
  await admin.from("user_interests").insert({ user_id: id, topic_key: "science" });
  return { email, id };
}

async function login(page: Page, email: string) {
  await page.goto("/fr/login");
  await page.getByLabel("Adresse courriel").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL(/\/fr\/app/, { timeout: 60_000 });
}

const users: string[] = [];
test.afterAll(async () => {
  for (const id of users) await admin.auth.admin.deleteUser(id).catch(() => undefined);
});

test("pricing page shows database prices in CAD", async ({ page }) => {
  await page.goto("/fr/pricing");
  await expect(page.getByRole("heading", { name: "Des tarifs simples" })).toBeVisible();
  await expect(page.getByText(/^9,99\s\$/)).toBeVisible();
  await expect(page.getByText(/^79,99\s\$/)).toBeVisible();
  await page.getByRole("link", { name: "Passer à Pro" }).click();
  await expect(page).toHaveURL(/\/fr\/login\?next=%2Ffr%2Fapp%2Fbilling$/); // protected
});

test("billing without Stripe is honest; a signed webhook upgrades the user", async ({ page, request }) => {
  const user = await createUser("Billing");
  users.push(user.id);
  await login(page, user.email);

  await page.goto("/fr/app/billing");
  await expect(page.getByTestId("current-plan")).toHaveText("Gratuit");
  await expect(page.getByText(/Le paiement en ligne n.est pas encore activé/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Pro mensuel/ })).toHaveCount(0);

  // Unsigned / badly signed requests are rejected by the real route.
  const unsigned = await request.post("/api/stripe/webhook", { data: { id: "evt_x" } });
  expect(unsigned.status()).toBe(400);

  // A correctly signed subscription event, as Stripe would send after checkout.
  const created = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({
    id: `evt_${crypto.randomUUID()}`,
    object: "event",
    type: "customer.subscription.created",
    created,
    data: {
      object: {
        id: `sub_e2e_${user.id.slice(0, 8)}`,
        object: "subscription",
        customer: `cus_e2e_${user.id.slice(0, 8)}`,
        status: "active",
        cancel_at_period_end: false,
        metadata: { userId: user.id },
        items: { data: [{ current_period_end: created + 30 * 86_400, price: { id: "price_e2e", lookup_key: "typemind_pro_yearly" } }] },
      },
    },
  });
  const forged = await request.post("/api/stripe/webhook", {
    data: payload,
    headers: { "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_wrong" }), "content-type": "application/json" },
  });
  expect(forged.status()).toBe(400);
  const signed = await request.post("/api/stripe/webhook", {
    data: payload,
    headers: { "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload, secret: E2E_WEBHOOK_SECRET }), "content-type": "application/json" },
  });
  expect(signed.status()).toBe(200);
  expect(await signed.json()).toEqual({ received: true, outcome: "processed" });

  await page.goto("/fr/app/billing");
  await expect(page.getByTestId("current-plan")).toHaveText("Pro (annuel)");
  await expect(page.getByText(/^Renouvellement le /)).toBeVisible();
  await expect(page.getByText("Textes IA ce mois-ci : 0 sur 150")).toBeVisible();
  // Pro: no 7-day limit on analytics.
  await page.goto("/fr/app/analytics");
  await expect(page.getByText(/^90 derniers jours$/)).toBeVisible();
});

test("data export contains only the user's own data", async ({ page }) => {
  const user = await createUser("Export");
  users.push(user.id);
  await login(page, user.email);
  const response = await page.request.get("/api/account/export");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-disposition"]).toMatch(/attachment; filename="typemind-export-/);
  const data = await response.json();
  // Supabase stores emails in lower case.
  expect(data.account).toEqual({ id: user.id, email: user.email.toLowerCase() });
  expect(data.interests.map((i: { topicKey: string }) => i.topicKey)).toEqual(["science"]);
  expect(data.preferences).toHaveLength(1);
  expect(data.preferences[0].userId).toBe(user.id);
  expect(JSON.stringify(data)).not.toContain("stripeCustomerId");

  const anonymous = await page.context().browser()!.newContext();
  expect((await anonymous.request.get("http://localhost:3000/api/account/export")).status()).toBe(401);
  await anonymous.close();
});

test("account deletion requires the email and removes everything", async ({ page }) => {
  const user = await createUser("Delete");
  await login(page, user.email);
  await page.goto("/fr/app/settings");
  const confirm = page.getByLabel(/Pour confirmer, tape ton adresse courriel/);
  await confirm.fill("wrong@example.test");
  await page.getByRole("button", { name: "Supprimer définitivement" }).click();
  await expect(page.getByText("L'adresse ne correspond pas.")).toBeVisible();

  await confirm.fill(user.email);
  await page.getByRole("button", { name: "Supprimer définitivement" }).click();
  await expect(page).toHaveURL(/\/fr$/, { timeout: 15_000 });

  const { data } = await admin.auth.admin.getUserById(user.id);
  expect(data.user).toBeNull();
  const { data: profile } = await admin.from("profiles").select("id").eq("id", user.id);
  expect(profile).toEqual([]);

  await page.goto("/fr/login");
  await page.getByLabel("Adresse courriel").fill(user.email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("Courriel ou mot de passe incorrect.")).toBeVisible();
});

test("admin page is hidden from users and shows aggregates to admins", async ({ page }) => {
  const user = await createUser("Admin");
  users.push(user.id);
  await login(page, user.email);
  // notFound() is raised inside streamed content, after the 200 status was sent:
  // what matters is that nothing from the admin page is rendered.
  await page.goto("/fr/app/admin");
  await expect(page.getByText("Page introuvable.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Administration" })).toHaveCount(0);
  await expect(page.getByText("Revenu mensuel récurrent (estimé)")).toHaveCount(0);

  await admin.from("app_admins").insert({ user_id: user.id });
  await page.goto("/fr/app/admin");
  await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
  await expect(page.getByText("Revenu mensuel récurrent (estimé)")).toBeVisible();
  // Aggregates only: no email on the page.
  await expect(page.locator("body")).not.toContainText("@example.test");
});
