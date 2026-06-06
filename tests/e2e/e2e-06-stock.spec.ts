import { test, expect } from "@playwright/test"
import { hasSupervisorCredentials, loginAsSupervisor } from "./helpers/auth"
import {
  finalizeReturn,
  openCautelaById,
  setReturnModeOnCardIndex,
  startReturnFlow,
} from "./helpers/cautela"
import { runSeedScript } from "./helpers/seed"

test.describe("E2E-06 Estoque (stock_quantity)", () => {
  test.beforeEach(() => {
    test.skip(!hasSupervisorCredentials(), "Credenciais E2E não configuradas")
  })

  test("devolução de 1 carregador restaura Disponível em /materials", async ({ page }) => {
    test.setTimeout(120_000)
    const seed = runSeedScript("scripts/qa/seed-stock-partial-return.mjs")
    const cautelaId = String(seed.cautela_id ?? "")
    const chargerPatrimony = String(seed.charger_patrimony ?? "")
    test.skip(!cautelaId || !chargerPatrimony, "seed E2E-06 incompleto")

    await loginAsSupervisor(page)
    await page.goto("/materials")
    await expect(page.getByRole("heading", { name: "Materiais" })).toBeVisible({ timeout: 15_000 })

    const rowBefore = page.locator("tr").filter({ hasText: chargerPatrimony }).first()
    await expect(rowBefore).toBeVisible({ timeout: 15_000 })
    await expect(rowBefore.getByText("Em Uso", { exact: true })).toBeVisible()

    await openCautelaById(page, cautelaId)
    await startReturnFlow(page)
    await setReturnModeOnCardIndex(page, 0, "Devolver total")
    await finalizeReturn(page, 1)

    await page.goto("/materials")
    await expect(page.getByRole("heading", { name: "Materiais" })).toBeVisible({ timeout: 15_000 })
    const rowAfter = page.locator("tr").filter({ hasText: chargerPatrimony }).first()
    await expect(rowAfter).toBeVisible({ timeout: 15_000 })
    await expect(rowAfter.getByText("Disponível", { exact: true })).toBeVisible()
  })
})
