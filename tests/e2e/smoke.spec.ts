import { test, expect } from "@playwright/test"

const email = process.env.E2E_SUPERVISOR_EMAIL
const password = process.env.E2E_SUPERVISOR_PASSWORD

test.describe("Smoke RESERVA", () => {
  test.beforeEach(() => {
    test.skip(
      !email || !password,
      "Defina E2E_SUPERVISOR_EMAIL e E2E_SUPERVISOR_PASSWORD (ver playwright.config.ts)"
    )
  })

  test("login supervisor e navegar para cautelas", async ({ page }) => {
    await page.goto("/auth/login")

    await expect(page.getByRole("heading", { name: "RESERVA" })).toBeVisible()

    await page.getByPlaceholder("operador@reserva.gov").fill(email!)
    await page.getByPlaceholder("••••••••").fill(password!)
    await page.getByRole("button", { name: "Acessar Sistema" }).click()

    await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 15_000 })
    await page.getByRole("navigation").waitFor({ state: "visible" })

    await page.getByRole("navigation").getByRole("link", { name: "Cautelas", exact: true }).click()
    await expect(page).toHaveURL(/\/cautelas/, { timeout: 15_000 })
    await expect(page.getByRole("heading", { name: "Cautelas" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Nova Cautela" })).toBeVisible()
  })
})
