import { test, expect } from "@playwright/test"
import { hasSupervisorCredentials, loginAsSupervisor } from "./helpers/auth"
import {
  createDailyCautelaWithPistol,
  e2ePersonMatricula,
  e2ePersonPin,
  openCautelasPage,
} from "./helpers/cautela"
import { runSeedScript } from "./helpers/seed"

test.describe("E2E-02 Nova cautela diária", () => {
  test.beforeAll(() => {
    test.skip(!hasSupervisorCredentials(), "Credenciais E2E não configuradas")
    runSeedScript("scripts/qa/seed-e2e-person.mjs")
  })

  test("cria cautela diária com mat. 999888 e PIN", async ({ page }) => {
    test.setTimeout(90_000)
    await loginAsSupervisor(page)
    await createDailyCautelaWithPistol(page, e2ePersonMatricula, e2ePersonPin)
    await openCautelasPage(page)
    await expect(page.getByText(/TESTE QA E2E|999888/).first()).toBeVisible()
    await expect(page.getByText("Aberta").first()).toBeVisible()
  })
})
