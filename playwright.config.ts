import { defineConfig, devices } from "@playwright/test";

export const E2E_WEBHOOK_SECRET = "whsec_e2e_only_not_a_real_secret";

/** E2E tests run against the local Supabase stack and its Mailpit inbox. */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  // Three browser engines + a production server on one machine: more workers made
  // 5-second UI assertions flaky under CPU contention (seen with WebKit on Windows).
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Typing input differs most between engines: cross-browser journeys are tagged @cross.
    { name: "firefox", use: { ...devices["Desktop Firefox"] }, grep: /@cross/ },
    { name: "webkit", use: { ...devices["Desktop Safari"] }, grep: /@cross/ },
  ],
  // Production build: realistic, and no on-demand compilation slowing the journeys down.
  // Set E2E_DEV=1 to reuse a running `npm run dev` instead.
  webServer: {
    command: process.env.E2E_DEV ? "npm run dev" : "npm run build && npm run start",
    url: "http://localhost:3000/fr",
    reuseExistingServer: Boolean(process.env.E2E_DEV),
    timeout: 300_000,
    // Test-only webhook secret so E2E can post signed events to the real route.
    // No STRIPE_SECRET_KEY: checkout must report "not configured", never fake a payment.
    env: { STRIPE_WEBHOOK_SECRET: E2E_WEBHOOK_SECRET },
  },
});
