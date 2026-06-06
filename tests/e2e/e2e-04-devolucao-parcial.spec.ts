import { test, expect } from "@playwright/test"
import { hasSupervisorCredentials, loginAsSupervisor } from "./helpers/auth"
import {
  finalizeReturn,
  openCautelaById,
  setPartialReturnQty,
  setReturnModeOnItem,
  startReturnFlow,
} from "./helpers/cautela"
import { runSeedScript } from "./helpers/seed"

test.describe("E2E-04 Devolução parcial (JHONNY)", () => {
  test.beforeEach(() => {
    test.skip(!hasSupervisorCredentials(), "Credenciais E2E não configuradas")
  })

  test("devolução parcial de carregadores mantém cautela Parcial", async ({ page }) => {
    test.setTimeout(90_000)
    const seed = runSeedScript("scripts/qa/seed-partial-return-demo.mjs")
    const cautelaId = String(seed.cautela_id ?? "")
    test.skip(!cautelaId, "cautela_id ausente após seed E2E-04")

    await loginAsSupervisor(page)
    await openCautelaById(page, cautelaId)

    await startReturnFlow(page)
    await setPartialReturnQty(page, /CARREGADOR GLOCK/i, 1)
    await setReturnModeOnItem(page, /PISTOLA GLOCK/i, "Devolver total")
    await setReturnModeOnItem(page, /MUNICAO 9MM/i, "Devolver total")
    await finalizeReturn(page)

    await expect(page.getByRole("heading", { name: "Detalhes da Cautela" })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText("Parcial", { exact: true })).toBeVisible()
  })
})
