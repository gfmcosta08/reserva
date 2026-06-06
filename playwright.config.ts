import { defineConfig, devices } from "@playwright/test"

/**
 * Smoke E2E — apontar para teste_db (local ou preview).
 *
 * Variáveis de ambiente:
 *   E2E_BASE_URL              — default http://localhost:3000
 *   E2E_SUPERVISOR_EMAIL      — ex.: qa.supervisor@reserva.test (ver docs/QA-E2E-TESTE-REPORT.md)
 *   E2E_SUPERVISOR_PASSWORD   — senha do operador QA (não commitar)
 *
 * Local: copie credenciais para .env.local ou exporte no shell antes de `npm run test:e2e`.
 * CI: configure secrets E2E_SUPERVISOR_EMAIL, E2E_SUPERVISOR_PASSWORD e opcionalmente E2E_BASE_URL.
 */
const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000"

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
