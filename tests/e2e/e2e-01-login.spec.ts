import { test, expect } from "@playwright/test"
import { hasSupervisorCredentials, loginAsSupervisor } from "./helpers/auth"

test.describe("E2E-01 Login supervisor", () => {
  test.beforeEach(() => {
    test.skip(!hasSupervisorCredentials(), "Credenciais E2E não configuradas")
  })

  test("login supervisor e navegar para cautelas", async ({ page }) => {
    await loginAsSupervisor(page)
    await page.getByRole("navigation").getByRole("link", { name: "Cautelas", exact: true }).click()
    await expect(page).toHaveURL(/\/cautelas/, { timeout: 15_000 })
    await expect(page.getByRole("heading", { name: "Cautelas" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Nova Cautela" })).toBeVisible()
  })
})
