import { test, expect } from "@playwright/test"
import { hasSupervisorCredentials, loginAsSupervisor } from "./helpers/auth"

test.describe("Regressão mínima — listagens", () => {
  test.beforeEach(() => {
    test.skip(!hasSupervisorCredentials(), "Credenciais E2E não configuradas")
  })

  test("/materials lista sem erro", async ({ page }) => {
    await loginAsSupervisor(page)
    await page.getByRole("navigation").getByRole("link", { name: "Materiais", exact: true }).click()
    await expect(page).toHaveURL(/\/materials/, { timeout: 15_000 })
    await expect(page.getByRole("heading", { name: "Materiais" })).toBeVisible()
  })

  test("/persons lista sem erro", async ({ page }) => {
    await loginAsSupervisor(page)
    await page.getByRole("navigation").getByRole("link", { name: "Pessoas", exact: true }).click()
    await expect(page).toHaveURL(/\/persons/, { timeout: 15_000 })
    await expect(page.getByRole("heading", { name: "Gestão de Pessoas" })).toBeVisible()
  })
})
