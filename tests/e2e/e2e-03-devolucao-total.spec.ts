import { test, expect } from "@playwright/test"
import { hasSupervisorCredentials, loginAsSupervisor } from "./helpers/auth"
import {
  finalizeReturn,
  openCautelaById,
  setReturnModeOnItem,
  startReturnFlow,
} from "./helpers/cautela"
import { runSeedScript } from "./helpers/seed"

test.describe("E2E-03 Devolução total", () => {
  test.beforeEach(() => {
    test.skip(!hasSupervisorCredentials(), "Credenciais E2E não configuradas")
  })

  test("devolve totalmente item da cautela demo E2E-03", async ({ page }) => {
    const seed = runSeedScript("scripts/qa/seed-e2e-total-return-demo.mjs")
    const cautelaId = String(seed.cautela_id ?? "")
    test.skip(!cautelaId, "cautela_id ausente após seed E2E-03")

    await loginAsSupervisor(page)
    await openCautelaById(page, cautelaId)

    await expect(page.getByText("HT QA E2E", { exact: true })).toBeVisible()
    await startReturnFlow(page)
    await setReturnModeOnItem(page, "HT QA E2E", "Devolver total")
    await finalizeReturn(page)

    await expect(page.getByRole("heading", { name: "Detalhes da Cautela" })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText("Fechada", { exact: true }).first()).toBeVisible()
  })
})
