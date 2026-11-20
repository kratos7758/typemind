/**
 * Journeys run on Chromium, Firefox and WebKit (tag @cross): text input events
 * (beforeinput, composition, Backspace) differ between browser engines.
 */
import { expect, test } from "@playwright/test";
import { admin, createOnboardedUser, exerciseText, expectFocusedInput, login } from "./helpers";

const created: string[] = [];
test.afterAll(async () => {
  for (const id of created) await admin.auth.admin.deleteUser(id).catch(() => undefined);
});

test("@cross typing a French text with accents, a correction, and saving", async ({ page, browserName }) => {
  test.setTimeout(180_000);
  // Playwright WebKit on Windows dispatches key events very slowly under parallel load.
  test.slow(browserName === "webkit", "WebKit key events are slow on Windows");
  const user = await createOnboardedUser("cross");
  created.push(user.id);
  await login(page, user.email);

  // Shortest library text that still contains é, è and à (WebKit on Windows types slowly).
  // 45 ms per key ≈ 22 keys/s: under the server's 25 keys/s plausibility limit.
  await page.goto("/fr/app/practice/text/fr-space-1");
  await expectFocusedInput(page);
  const text = await exerciseText(page);
  expect(text).toMatch(/é/);
  expect(text).toMatch(/è/);
  expect(text).toMatch(/à/);

  // A mistake, corrected with Backspace, then the rest of the text.
  await page.keyboard.type(text.slice(0, 10), { delay: 45 });
  await page.keyboard.type("#", { delay: 45 });
  await expect(page.getByTestId("live-accuracy")).not.toHaveText(/^100/);
  await page.keyboard.press("Backspace");
  await page.keyboard.type(text.slice(10), { delay: 45 });

  await expect(page.getByRole("heading", { name: "Résultats" })).toBeVisible();
  await expect(page.getByTestId("save-status")).toHaveText("Séance enregistrée.", { timeout: 15_000 });
  // One corrected error, none left.
  await expect(page.locator("dt", { hasText: "Erreurs corrigées" }).locator("+ dd")).toHaveText("1");
  await expect(page.locator("dt", { hasText: "Erreurs restantes" }).locator("+ dd")).toHaveText("0");
});

test("@cross pause with Escape, restart with Tab, paste is blocked", async ({ page }) => {
  test.setTimeout(180_000);
  const user = await createOnboardedUser("cross-keys");
  created.push(user.id);
  await login(page, user.email);

  await page.goto("/fr/app/practice/text/fr-space-1");
  await expectFocusedInput(page);
  const text = await exerciseText(page);
  await page.keyboard.type(text.slice(0, 5), { delay: 30 });
  await page.keyboard.press("Escape");
  await expect(page.getByText(/En pause/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText(/En pause/)).toHaveCount(0);

  await page.keyboard.press("Tab");
  await page.keyboard.type(text.slice(0, 3), { delay: 30 });
  // Restart went back to the beginning: three correct characters, 100 %.
  await expect(page.getByTestId("live-accuracy")).toHaveText(/^100/);

  // Pasting the whole text must not type it.
  await page.evaluate((t) => {
    const input = document.querySelector<HTMLTextAreaElement>('[data-testid="typing-input"]')!;
    const event = new InputEvent("beforeinput", { inputType: "insertFromPaste", data: t, cancelable: true, bubbles: true });
    input.dispatchEvent(event);
  }, text);
  await expect(page.getByRole("heading", { name: "Résultats" })).toHaveCount(0);
});

test("@cross public pages and security headers", async ({ page }) => {
  const response = await page.goto("/fr/pricing");
  const headers = response!.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-powered-by"]).toBeUndefined();
  await expect(page.getByRole("heading", { name: "Des tarifs simples" })).toBeVisible();

  await page.getByRole("link", { name: "Confidentialité" }).click();
  await expect(page.getByRole("heading", { name: "Politique de confidentialité" })).toBeVisible();
  await expect(page.getByText(/Ébauche à faire valider par un juriste/)).toBeVisible();
  await page.getByRole("link", { name: "English" }).click();
  await expect(page.getByRole("heading", { name: "Privacy policy" })).toBeVisible();
});
