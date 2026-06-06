import { test, expect } from "@playwright/test"
import { hasSupervisorCredentials, loginAsSupervisor } from "./helpers/auth"
import {
  finalizeReturn,
  openCautelaById,
  setPartialReturnOnCardIndex,
  setReturnModeOnCardIndex,
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
    await setReturnModeOnCardIndex(page, 0, "Devolver total")
    await setReturnModeOnCardIndex(page, 2, "Devolver total")
    await setPartialReturnOnCardIndex(page, 1, 1)
    await finalizeReturn(page, 3)

    await expect(page.getByRole("heading", { name: "Detalhes da Cautela" })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText("Parcial", { exact: true })).toBeVisible()
  })
})
