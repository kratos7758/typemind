/**
 * Guest mode (ADR-027): start without an account, practise, then turn the guest into a
 * regular account and find the same progress after signing in again.
 */
import { expect, test } from "@playwright/test";
import { admin, exerciseText } from "./helpers";
import { waitForEmailLink } from "./mailpit";

let userId: string | undefined;

test.afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId);
});

test("start without an account → practise → save progress → sign in again", async ({ page }) => {
  test.setTimeout(180_000);
  const email = `guest-${Date.now()}@example.test`;
  const password = "guest-password-123";

  await page.goto("/fr");
  await page.getByRole("button", { name: "Commencer gratuitement" }).click();
  await expect(page).toHaveURL(/\/fr\/onboarding$/, { timeout: 20_000 });

  // The guest is a real (anonymous) Supabase user with the per-user rows of the trigger.
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const guest = users.users
    .filter((u) => u.is_anonymous)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  userId = guest?.id;
  expect(userId).toBeTruthy();

  // Onboarding: 1 language, 2 layout, 3 experience, 4 goals, 5 interests, 6 daily goal.
  const next = page.getByRole("button", { name: "Continuer" });
  await page.getByRole("radio", { name: "Français" }).click();
  await next.click();
  await page.getByRole("radio", { name: "Français — AZERTY" }).click();
  await next.click();
  await page.getByRole("radio", { name: /Je tape sans trop regarder/ }).click();
  await next.click();
  await page.getByRole("checkbox", { name: "Taper plus vite" }).click();
  await next.click();
  await page.getByRole("checkbox", { name: "Sciences" }).click();
  await next.click();
  await page.getByRole("radio", { name: "15 min" }).click();
  await page.getByRole("button", { name: "Terminer et passer le test" }).click();

  // Placement test, saved on the server like any session.
  await expect(page).toHaveURL(/\/fr\/app\/practice\/assessment\/fr$/, { timeout: 20_000 });
  await expect(page.getByTestId("typing-input")).toBeFocused();
  await page.keyboard.type(await exerciseText(page), { delay: 60 });
  await expect(page.getByTestId("save-status")).toHaveText("Séance enregistrée.", { timeout: 15_000 });

  await page.goto("/fr/app");
  await expect(page.getByText("Mode invité : ta progression n'est gardée que dans ce navigateur.")).toBeVisible();
  await expect(page.getByText("Test de niveau").first()).toBeVisible();

  // Paid or costly features are locked for guests on the server, not only in the UI.
  const ai = await page.request.post("/api/ai/exercise", { data: { topic: "science" } });
  expect(ai.status()).toBe(403);

  // Save the progress: the register page knows it is converting a guest.
  await page.getByRole("link", { name: "Créer un compte pour la conserver" }).click();
  await expect(page).toHaveURL(/\/fr\/register$/);
  await expect(page.getByRole("heading", { name: "Garde ta progression" })).toBeVisible();
  await page.getByLabel("Adresse courriel").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByLabel("Prénom ou pseudo (facultatif)").fill("Noé");
  await page.getByLabel("18 ans et plus").check();
  await page.getByLabel(/J'accepte les conditions/).check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  // Local Supabase confirms emails: the address waits for the link.
  await expect(page.getByRole("heading", { name: "Vérifie ta boîte courriel" })).toBeVisible();
  await page.goto(await waitForEmailLink(email));
  await expect(page).toHaveURL(/\/fr\/app$/);
  await expect(page.getByRole("heading", { name: "Bonjour Noé 👋" })).toBeVisible();
  await expect(page.getByText("Mode invité", { exact: false })).toHaveCount(0);

  // Same account (same id), with its history, after a fresh sign-in.
  await page.getByRole("button", { name: "Déconnexion" }).click();
  await expect(page).toHaveURL(/\/fr$/);
  await page.goto("/fr/login");
  await page.getByLabel("Adresse courriel").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/fr\/app$/, { timeout: 20_000 });
  await expect(page.getByText("Test de niveau").first()).toBeVisible();

  const { data: converted } = await admin.auth.admin.getUserById(userId!);
  expect(converted.user?.is_anonymous).toBe(false);
  expect(converted.user?.email).toBe(email);
});
