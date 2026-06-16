import { test, expect } from "@playwright/test"
import { hasSupervisorCredentials, loginAsSupervisor } from "./helpers/auth"
import {
  addPistolPackToCautela,
  e2ePersonMatricula,
  e2ePersonPin,
  e2ePistolPatrimony,
  goToCautelaSummary,
  openCautelasPage,
  selectPersonByMatricula,
  startNovaCautela,
} from "./helpers/cautela"
import { runSeedScript } from "./helpers/seed"

test.describe("E2E-09 Pacote pistola completo (como produção)", () => {
  test.beforeAll(() => {
    test.skip(!hasSupervisorCredentials(), "Credenciais E2E não configuradas")
    runSeedScript("scripts/qa/seed-e2e-pistol-pack.mjs")
  })

  test("adiciona pacote pistola com 3 carregadores e 50 munições", async ({ page }) => {
    test.setTimeout(120_000)
    await loginAsSupervisor(page)
    await openCautelasPage(page)
    await startNovaCautela(page)
    await selectPersonByMatricula(page, e2ePersonMatricula)
    await page.getByRole("button", { name: /Próximo: Materiais/i }).click()
    await expect(page.getByRole("heading", { name: "Materiais" })).toBeVisible()

    await addPistolPackToCautela(page, {
      weaponSearch: e2ePistolPatrimony,
      chargers: 3,
      ammo: 50,
    })

    await goToCautelaSummary(page)
    await expect(page.getByText(/PISTOLA QA E2E|PAT-E2E-GLK-001/i).first()).toBeVisible()
    await expect(page.getByText(/CARREGADOR|MUNICAO|9MM/i).first()).toBeVisible()
  })
})
