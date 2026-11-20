/**
 * Accessibility (axe-core, WCAG 2.1 A/AA) on key pages in light and dark themes,
 * keyboard navigation basics, and typing responsiveness (no long tasks while typing).
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { admin, createOnboardedUser, exerciseText, expectFocusedInput, login } from "./helpers";

const created: string[] = [];
test.afterAll(async () => {
  for (const id of created) await admin.auth.admin.deleteUser(id).catch(() => undefined);
});

async function audit(page: Page, name: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = results.violations.map((v) => ({
    page: name,
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.slice(0, 3).map((n) => `${n.target.join(" ")} — ${n.failureSummary?.split("\n")[1]?.trim() ?? ""}`),
  }));
  expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
}

for (const scheme of ["light", "dark"] as const) {
  test(`accessibility (${scheme})`, async ({ browser }) => {
    test.setTimeout(240_000);
    const context = await browser.newContext({ colorScheme: scheme });
    const page = await context.newPage();

    for (const path of ["/fr", "/fr/pricing", "/fr/login", "/fr/register", "/fr/privacy", "/en"]) {
      await page.goto(path);
      await page.locator("h1").first().waitFor();
      await audit(page, `${scheme} ${path}`);
    }

    const user = await createOnboardedUser(`a11y-${scheme}`);
    created.push(user.id);
    await login(page, user.email);
    for (const [path, ready] of [
      ["/fr/app", "h1"],
      ["/fr/app/practice", "text=Cours progressif"],
      ["/fr/app/practice/text/fr-science-1", '[data-testid="typing-text"]'],
      ["/fr/app/analytics", "text=Records"],
      ["/fr/app/settings", "text=Mes données"],
      ["/fr/app/billing", '[data-testid="current-plan"]'],
    ] as const) {
      await page.goto(path);
      await page.locator(ready).first().waitFor();
      await audit(page, `${scheme} ${path}`);
    }
    await context.close();
  });
}

test("skip link moves focus to the main content", async ({ page }) => {
  await page.goto("/fr/pricing");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Aller au contenu" });
  await expect(skip).toBeFocused();
  await skip.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
});

test("typing stays responsive: no long task while typing", async ({ page }) => {
  test.setTimeout(120_000);
  const user = await createOnboardedUser("perf");
  created.push(user.id);
  await login(page, user.email);
  await page.goto("/fr/app/practice/text/fr-finance-1");
  await expectFocusedInput(page);
  const text = await exerciseText(page);

  await page.evaluate(() => {
    const w = window as unknown as { __longTasks: number[] };
    w.__longTasks = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) w.__longTasks.push(entry.duration);
    }).observe({ type: "longtask", buffered: false });
  });
  // ~250 characters at a fast human pace (60 ms ≈ 200 WPM).
  await page.keyboard.type(text.slice(0, 250), { delay: 60 });
  const longTasks = await page.evaluate(() => (window as unknown as { __longTasks: number[] }).__longTasks);
  expect(longTasks, `long tasks (ms): ${longTasks.join(", ")}`).toEqual([]);
});
