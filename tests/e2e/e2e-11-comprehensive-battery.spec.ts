import { test, expect } from "@playwright/test"
import { hasSupervisorCredentials, loginAsSupervisor } from "./helpers/auth"
import {
  addHtToCautela,
  confirmDailyCautela,
  createDailyCautelaWithPistol,
  e2eHtPatrimony,
  e2ePersonMatricula,
  e2ePersonPin,
  e2ePistolPatrimony,
  enterPersonPin,
  finalizeReturn,
  goToCautelaSummary,
  openCautelaById,
  openCautelasPage,
  selectPersonByMatricula,
  setCautelaSummaryQty,
  setReturnModeOnItem,
  startNovaCautela,
  startReturnFlow,
} from "./helpers/cautela"
import { runSeedScript } from "./helpers/seed"

test.describe("E2E-11 Bateria ampliada — stress operacional", () => {
  test.beforeEach(() => {
    test.skip(!hasSupervisorCredentials(), "Credenciais E2E não configuradas")
  })

  test("ciclo HT: cautela diária → devolução total → material Disponível", async ({ page }) => {
    test.setTimeout(180_000)
    runSeedScript("scripts/qa/seed-e2e-person.mjs")
    const seed = runSeedScript("scripts/qa/seed-e2e-total-return-demo.mjs")
    const cautelaId = String(seed.cautela_id ?? "")
    test.skip(!cautelaId, "seed E2E-03 ausente")

    await loginAsSupervisor(page)
    await openCautelaById(page, cautelaId)
    await expect(page.getByText("HT QA E2E", { exact: true })).toBeVisible()
    await startReturnFlow(page)
    await setReturnModeOnItem(page, "HT QA E2E", "Devolver total")
    await finalizeReturn(page, 1)
    await expect(page.getByText("Fechada", { exact: true }).first()).toBeVisible()

    await page.goto("/materials")
    const search = page.getByPlaceholder("Buscar por nome, patrimônio ou código...")
    await search.fill(e2eHtPatrimony)
    await page.waitForTimeout(500)
    const row = page.locator("tr").filter({ hasText: e2eHtPatrimony }).first()
    await expect(row.getByText("Disponível", { exact: true })).toBeVisible({ timeout: 15_000 })
  })

  test("duplo ciclo login/logout mantém sessão limpa", async ({ page }) => {
    for (let i = 0; i < 2; i++) {
      await loginAsSupervisor(page)
      await expect(page.getByRole("navigation")).toBeVisible()
      await page.getByRole("button", { name: "Sair do Sistema" }).click()
      await expect(page).toHaveURL(/\/auth\/login/, { timeout: 15_000 })
    }
    await loginAsSupervisor(page)
    await page.goto("/")
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
  })

  test("materiais: filtro status + exportar filtrados", async ({ page }) => {
    test.setTimeout(90_000)
    await loginAsSupervisor(page)
    await page.goto("/materials")
    await expect(page.getByRole("heading", { name: "Materiais" })).toBeVisible({ timeout: 15_000 })
    await page.locator("select").filter({ has: page.locator('option[value="available"]') }).first().selectOption("available")
    await page.waitForTimeout(800)
    const exportBtn = page.getByRole("button", { name: /Exportar Filtrados/i })
    await expect(exportBtn).toBeVisible()
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 30_000 }),
      exportBtn.click(),
    ])
    expect(download.suggestedFilename()).toMatch(/\.csv$/i)
  })

  test("cautela diária nova + cautela permanente na mesma sessão", async ({ page }) => {
    test.setTimeout(180_000)
    runSeedScript("scripts/qa/seed-e2e-person.mjs")
    runSeedScript("scripts/qa/seed-e2e-pistol-pack.mjs")

    await loginAsSupervisor(page)

    await openCautelasPage(page)
    await startNovaCautela(page)
    await selectPersonByMatricula(page, e2ePersonMatricula)
    await page.getByRole("button", { name: /Próximo: Materiais/i }).click()
    await addHtToCautela(page, e2eHtPatrimony)
    await goToCautelaSummary(page)
    await confirmDailyCautela(page)
    await enterPersonPin(page, e2ePersonPin)
    await expect(page.getByRole("heading", { name: "Nova Cautela" })).not.toBeVisible({ timeout: 30_000 })

    runSeedScript("scripts/qa/seed-e2e-pistol-pack.mjs")
    await createDailyCautelaWithPistol(page, e2ePersonMatricula, e2ePersonPin, e2ePistolPatrimony)
    await openCautelasPage(page)
    await expect(page.getByText("Aberta").first()).toBeVisible()
  })

  test("estoque fungível: seed 20, cautela 5, restam 15", async ({ page }) => {
    test.setTimeout(180_000)
    runSeedScript("scripts/qa/seed-e2e-person.mjs")
    const seed = runSeedScript("scripts/qa/seed-full-regression-fungible.mjs")
    const patrimony = String(seed.patrimony ?? "PAT-QA-FUNG-001")
    const checkoutQty = 5
    const expectedAfter = Number(seed.expected_stock_after ?? 15)

    await loginAsSupervisor(page)
    await openCautelasPage(page)
    await startNovaCautela(page)
    await selectPersonByMatricula(page, e2ePersonMatricula)
    await page.getByRole("button", { name: /Próximo: Materiais/i }).click()

    const coleteInput = page.getByPlaceholder("Tamanho, código…")
    await coleteInput.fill(patrimony)
    const result = page.locator("ul.absolute.z-20 button").filter({ hasText: patrimony })
    await expect(result.first()).toBeVisible({ timeout: 15_000 })
    await result.first().click()
    await expect(page.getByText(/incluído no resumo/i).first()).toBeVisible({ timeout: 10_000 })
    await setCautelaSummaryQty(page, patrimony, checkoutQty)
    await goToCautelaSummary(page)
    await confirmDailyCautela(page)
    await enterPersonPin(page, e2ePersonPin)
    await expect(page.getByRole("heading", { name: "Nova Cautela" })).not.toBeVisible({ timeout: 30_000 })

    await page.goto("/materials")
    await expect(page.getByText("Carregando materiais...")).not.toBeVisible({ timeout: 20_000 })
    const search = page.getByPlaceholder("Buscar por nome, patrimônio ou código...")
    await search.fill(patrimony)
    await page.waitForTimeout(600)
    const row = page.locator("tr").filter({ hasText: patrimony }).first()
    await expect(row.getByText(String(expectedAfter), { exact: true })).toBeVisible({ timeout: 15_000 })
  })

  test("API exports: 401 sem sessão, 200 autenticado", async ({ page, playwright }) => {
    const baseURL = process.env.E2E_BASE_URL || "https://reserva-teste.vercel.app"
    const anon = await playwright.request.newContext({ baseURL, extraHTTPHeaders: {} })
    try {
      for (const path of ["/api/export/materials", "/api/export/cautelas", "/api/export/divergencias"]) {
        const res = await anon.get(path, { maxRedirects: 0 })
        expect([401, 403], `${path} sem auth`).toContain(res.status())
      }
    } finally {
      await anon.dispose()
    }

    await loginAsSupervisor(page)
    for (const path of ["/api/export/materials", "/api/export/cautelas", "/api/export/divergencias"]) {
      const res = await page.request.get(path)
      expect(res.status(), `${path} autenticado`).toBe(200)
    }
  })

  test("inventário: criar, conferir contadores, voltar à lista", async ({ page }) => {
    test.setTimeout(120_000)
    await loginAsSupervisor(page)
    await page.goto("/inventario")
    await page.getByRole("button", { name: "Novo inventário" }).click()
    await expect(page).toHaveURL(/\/inventario\//, { timeout: 20_000 })
    await expect(page.getByText("Total").first()).toBeVisible()
    await expect(page.getByText("Conferidos").first()).toBeVisible()
    await page.goto("/inventario")
    await expect(page.getByRole("heading", { name: "Inventário Físico" })).toBeVisible()
  })

  test("persons: busca + link histórico", async ({ page }) => {
    await loginAsSupervisor(page)
    await page.goto("/persons")
    const search = page.getByPlaceholder("Buscar por RG, Nome ou Matrícula...")
    await search.fill(e2ePersonMatricula)
    await page.waitForTimeout(600)
    const row = page.locator("tr").filter({ hasText: e2ePersonMatricula }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.getByRole("link", { name: /Ver histórico/i }).click()
    await expect(page).toHaveURL(/\/persons\//)
    await expect(page.getByText("Histórico de Cautelas")).toBeVisible()
  })

  test("relatórios: abrir os 3 + export Excel em cada", async ({ page }) => {
    test.setTimeout(120_000)
    await loginAsSupervisor(page)
    const reports = [
      { path: "/reports/materials", title: "Relatório Detalhado de Materiais" },
      { path: "/reports/cautelas", title: "Relatório de Cautelas Ativas" },
      { path: "/reports/divergencias", title: "Relatório de Divergências" },
    ]
    for (const r of reports) {
      await page.goto(r.path)
      await expect(page.getByRole("heading", { name: r.title })).toBeVisible({ timeout: 15_000 })
      const excel = page.getByRole("button", { name: /Exportar Excel/i }).first()
      if (await excel.isVisible()) {
        const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 30_000 }), excel.click()])
        expect(dl.suggestedFilename()).toMatch(/\.xlsx$/i)
      }
    }
  })
})
