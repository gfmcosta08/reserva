import { defineConfig, devices } from "@playwright/test"
import { existsSync, readFileSync } from "fs"
import { join } from "path"

function loadQaEnvFile(): void {
  const envPath = join(__dirname, "scripts/.env.qa")
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
  if (!process.env.E2E_SUPERVISOR_EMAIL && process.env.QA_SUPERVISOR_EMAIL) {
    process.env.E2E_SUPERVISOR_EMAIL = process.env.QA_SUPERVISOR_EMAIL
  }
  if (!process.env.E2E_SUPERVISOR_PASSWORD && process.env.QA_SUPERVISOR_PASSWORD) {
    process.env.E2E_SUPERVISOR_PASSWORD = process.env.QA_SUPERVISOR_PASSWORD
  }
}

loadQaEnvFile()

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
const vercelBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    ...(vercelBypass
      ? {
          extraHTTPHeaders: {
            "x-vercel-protection-bypass": vercelBypass,
            "x-vercel-set-bypass-cookie": "true",
          },
        }
      : {}),
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
