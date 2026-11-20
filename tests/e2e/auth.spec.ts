import { expect, test } from "@playwright/test";
import { countEmails, waitForEmailLink } from "./mailpit";

test.describe("routing", () => {
  test("redirects / to a locale based on Accept-Language", async ({ browser }) => {
    const context = await browser.newContext({ locale: "en-US" });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Learn typing through what you love.");
    await context.close();
  });

  test("protects the app area", async ({ page }) => {
    await page.goto("/fr/app");
    await expect(page).toHaveURL(/\/fr\/login\?next=%2Ffr%2Fapp$/);
  });

  test("language switch keeps the current page", async ({ page }) => {
    await page.goto("/fr/login");
    await page.getByRole("link", { name: "English" }).click();
    await expect(page).toHaveURL(/\/en\/login$/);
  });
});

test("register → confirm email → app → logout → login → reset password", async ({ page }) => {
  // Long journey (~10 pages, each compiled on first visit by the dev server).
  test.setTimeout(120_000);
  const email = `e2e-${Date.now()}@example.test`;
  const password = "first-password-123";
  const newPassword = "second-password-456";

  // Validation errors are shown and the form keeps its values.
  await page.goto("/fr/register");
  await page.getByLabel("Adresse courriel").fill(email);
  await page.getByLabel("Mot de passe").fill("court");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByText("Le mot de passe doit contenir au moins 10 caractères.")).toBeVisible();
  await expect(page.getByText("Choisis ta tranche d'âge.")).toBeVisible();
  await expect(page.getByText("Tu dois accepter les conditions pour continuer.")).toBeVisible();
  await expect(page.getByLabel("Adresse courriel")).toHaveValue(email);

  // Valid registration.
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByLabel("Prénom ou pseudo (facultatif)").fill("Camille");
  await page.getByLabel("18 ans et plus").check();
  await page.getByLabel(/J'accepte les conditions/).check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByRole("heading", { name: "Vérifie ta boîte courriel" })).toBeVisible();

  // Unconfirmed accounts cannot log in.
  await page.goto("/fr/login");
  await page.getByLabel("Adresse courriel").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("Confirme d'abord ton adresse")).toBeVisible();

  // Confirmation link signs the user in and starts onboarding.
  await page.goto(await waitForEmailLink(email));
  await expect(page).toHaveURL(/\/fr\/onboarding$/);
  await expect(page.getByRole("heading", { name: "Personnalisons ton apprentissage" })).toBeVisible();

  // Logged-in users are sent away from guest pages (and back to onboarding until it's done).
  await page.goto("/fr/login");
  await expect(page).toHaveURL(/\/fr\/onboarding$/);

  await page.getByRole("button", { name: "Déconnexion" }).click();
  await expect(page).toHaveURL(/\/fr$/);

  // Wrong password.
  await page.goto("/fr/login");
  await page.getByLabel("Adresse courriel").fill(email);
  await page.getByLabel("Mot de passe").fill("not-the-password");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("Courriel ou mot de passe incorrect.")).toBeVisible();

  // Password recovery.
  const before = await countEmails(email);
  await page.goto("/fr/forgot-password");
  await page.getByLabel("Adresse courriel").fill(email);
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(page.getByText("Si un compte existe pour cette adresse")).toBeVisible();

  await page.goto(await waitForEmailLink(email, { after: before }));
  await expect(page).toHaveURL(/\/fr\/reset-password$/);
  await page.getByLabel("Mot de passe").fill(newPassword);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page).toHaveURL(/\/fr\/onboarding$/);

  // New password works.
  await page.getByRole("button", { name: "Déconnexion" }).click();
  await expect(page).toHaveURL(/\/fr$/);
  await page.goto("/fr/login");
  await page.getByLabel("Adresse courriel").fill(email);
  await page.getByLabel("Mot de passe").fill(newPassword);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/fr\/onboarding$/);
});
