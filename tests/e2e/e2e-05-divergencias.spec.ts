import { test, expect } from "@playwright/test"
import { hasSupervisorCredentials, loginAsSupervisor } from "./helpers/auth"

test.describe("E2E-05 Relatório divergências", () => {
  test.beforeEach(() => {
    test.skip(!hasSupervisorCredentials(), "Credenciais E2E não configuradas")
  })

  test("página /reports/divergencias carrega", async ({ page }) => {
    await loginAsSupervisor(page)
    await page.goto("/reports/divergencias")
    await expect(page.getByRole("heading", { name: "Relatório de Divergências" })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole("button", { name: "Exportar CSV" })).toBeVisible()
  })
})
