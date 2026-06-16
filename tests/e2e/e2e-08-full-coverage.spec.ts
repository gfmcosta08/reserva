import { test, expect } from "@playwright/test"
import { hasSupervisorCredentials, loginAsSupervisor } from "./helpers/auth"
import {
  confirmDailyCautela,
  e2ePersonMatricula,
  e2ePersonPin,
  e2ePistolPatrimony,
  enterPersonPin,
  goToCautelaSummary,
  openCautelasPage,
  selectPersonByMatricula,
  setCautelaSummaryQty,
  startNovaCautela,
} from "./helpers/cautela"
import { runSeedScript } from "./helpers/seed"

test.describe("E2E-08 Regressão completa — cobertura adicional", () => {
  test.beforeEach(() => {
    test.skip(!hasSupervisorCredentials(), "Credenciais E2E não configuradas")
  })

  test("GET /api/version confirma ambiente teste_db", async ({ request }) => {
    const res = await request.get("/api/version")
    expect(res.status()).toBe(200)
    const json = (await res.json()) as {
      app?: string
      supabaseEnv?: string
      supabaseRef?: string
    }
    expect(json.app).toBe("RESERVA")
    expect(json.supabaseEnv).toBe("teste_db")
    expect(json.supabaseRef).toBe("ajyvznrmbuistlcfckuh")
  })

  test("exports API retornam 401 sem autenticação", async ({ playwright }) => {
    const baseURL = process.env.E2E_BASE_URL || "https://reserva-teste.vercel.app"
    // Contexto isolado SEM bypass Vercel — bypass concede acesso às rotas protegidas da app.
    const context = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: {},
    })
    try {
      for (const path of ["/api/export/materials", "/api/export/cautelas", "/api/export/divergencias"]) {
        const response = await context.get(path, { maxRedirects: 0 })
        expect([401, 403], `${path} sem auth`).toContain(response.status())
      }
    } finally {
      await context.dispose()
    }
  })

  test("dashboard carrega estatísticas", async ({ page }) => {
    await loginAsSupervisor(page)
    await page.goto("/")
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText("Total de Materiais")).toBeVisible()
    await expect(page.getByText("Cautelas Ativas")).toBeVisible()
  })

  test("cadastro de material via UI com stock_quantity", async ({ page }) => {
    test.setTimeout(90_000)
    const stamp = Date.now()
    const patrimony = `PAT-QA-UI-${stamp}`
    const name = `Material QA UI ${stamp}`

    await loginAsSupervisor(page)
    await page.goto("/materials")
    await expect(page.getByText("Carregando materiais...")).not.toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole("heading", { name: "Materiais" })).toBeVisible({ timeout: 15_000 })
    await page.getByRole("button", { name: "Novo Material" }).click()
    await expect(page.getByRole("heading", { name: "Novo Material" })).toBeVisible()

    const modal = page.locator('[role="dialog"][aria-labelledby="material-form-title"]')
    await modal.getByPlaceholder("Ex: Glock G17 Gen 5").fill(name)
    await modal.locator('input[name="category"]').fill("COLETE BALISTICO")
    await modal.locator('input[name="patrimony_number"]').fill(patrimony)
    await modal.locator('input[name="serial_number"]').fill(`SN-${stamp}`)
    await modal.locator('input[name="internal_code"]').fill(`INT-${stamp}`)
    await modal.locator('input[name="stock_quantity"]').fill("12")
    const saveBtn = modal.getByRole("button", { name: "Salvar Material" })
    await saveBtn.scrollIntoViewIfNeeded()
    await saveBtn.click()
    const errorBox = modal.locator(".text-red-500")
    await expect
      .poll(
        async () => {
          if (!(await page.getByRole("heading", { name: "Novo Material" }).isVisible())) return "closed"
          if (await errorBox.isVisible().catch(() => false)) return `error:${await errorBox.textContent()}`
          return "open"
        },
        { timeout: 20_000 }
      )
      .not.toBe("open")
    if (await errorBox.isVisible().catch(() => false)) {
      throw new Error(`Falha ao salvar material: ${await errorBox.textContent()}`)
    }

    await page.reload()
    await expect(page.getByText("Carregando materiais...")).not.toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole("heading", { name: "Materiais" })).toBeVisible()

    const search = page.getByPlaceholder("Buscar por nome, patrimônio ou código...")
    await search.fill(patrimony)
    await page.waitForTimeout(600)
    const row = page.locator("tr").filter({ hasText: patrimony }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })
    await expect(row.getByText("12", { exact: true })).toBeVisible()
    await expect(row.getByText("Disponível", { exact: true })).toBeVisible()
  })

  test("saída de cautela reduz estoque fungível (20 → 15)", async ({ page }) => {
    test.setTimeout(120_000)
    runSeedScript("scripts/qa/seed-e2e-person.mjs")
    const seed = runSeedScript("scripts/qa/seed-full-regression-fungible.mjs")
    const patrimony = String(seed.patrimony ?? "")
    const initialStock = Number(seed.initial_stock ?? 20)
    const checkoutQty = 5
    const expectedAfter = Number(seed.expected_stock_after ?? initialStock - checkoutQty)
    test.skip(!patrimony, "seed fungível incompleto")

    await loginAsSupervisor(page)
    await page.goto("/materials")
    const search = page.getByPlaceholder("Buscar por nome, patrimônio ou código...")
    await search.fill(patrimony)
    await page.waitForTimeout(600)
    const rowBefore = page.locator("tr").filter({ hasText: patrimony }).first()
    await expect(rowBefore).toBeVisible({ timeout: 15_000 })
    await expect(rowBefore.getByText(String(initialStock), { exact: true })).toBeVisible()

    await openCautelasPage(page)
    await startNovaCautela(page)
    await selectPersonByMatricula(page, e2ePersonMatricula)
    await page.getByRole("button", { name: /Próximo: Materiais/i }).click()
    await expect(page.getByRole("heading", { name: "Materiais" })).toBeVisible()

    const coleteInput = page.getByPlaceholder("Tamanho, código…")
    await coleteInput.scrollIntoViewIfNeeded()
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
    await search.fill(patrimony)
    await page.waitForTimeout(600)
    const rowAfter = page.locator("tr").filter({ hasText: patrimony }).first()
    await expect(rowAfter).toBeVisible({ timeout: 15_000 })
    await expect(rowAfter.getByText(String(expectedAfter), { exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(rowAfter.getByText("Disponível", { exact: true })).toBeVisible()
  })

  test("cautela permanente via UI", async ({ page }) => {
    test.setTimeout(120_000)
    runSeedScript("scripts/qa/seed-e2e-person.mjs")
    runSeedScript("scripts/qa/seed-e2e-pistol-pack.mjs")

    await loginAsSupervisor(page)
    await openCautelasPage(page)
    await startNovaCautela(page)
    await selectPersonByMatricula(page, e2ePersonMatricula)
    await page.getByRole("button", { name: /Próximo: Materiais/i }).click()

    const pistolInput = page.getByRole("textbox", { name: /Patrimônio, serial, código — só pistolas/i })
    await pistolInput.scrollIntoViewIfNeeded()
    await pistolInput.fill(e2ePistolPatrimony)
    const pistolResult = page.locator("ul.absolute.z-20 button").filter({ hasText: e2ePistolPatrimony })
    await expect(pistolResult.first()).toBeVisible({ timeout: 15_000 })
    await pistolResult.first().click()
    await page.getByRole("button", { name: /Incluir só a pistola/i }).click()

    await goToCautelaSummary(page)
    await page.getByRole("button", { name: "Permanente", exact: true }).click()
    await page.getByRole("button", { name: /Próximo: (PIN|Assinatura)/i }).click()
    await enterPersonPin(page, e2ePersonPin)
    await expect(page.getByRole("heading", { name: "Nova Cautela" })).not.toBeVisible({ timeout: 30_000 })

    await openCautelasPage(page)
    await expect(page.getByText("Permanente").first()).toBeVisible({ timeout: 15_000 })
  })

  test("página de detalhe da pessoa E2E carrega histórico", async ({ page }) => {
    runSeedScript("scripts/qa/seed-e2e-person.mjs")
    await loginAsSupervisor(page)
    await page.goto("/persons")
    await expect(page.getByRole("heading", { name: "Gestão de Pessoas" })).toBeVisible({ timeout: 15_000 })

    const search = page.getByPlaceholder("Buscar por RG, Nome ou Matrícula...")
    await search.fill(e2ePersonMatricula)
    await page.waitForTimeout(800)

    const row = page.locator("tr").filter({ hasText: e2ePersonMatricula }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.getByRole("link", { name: /Ver histórico de cautelas/i }).click()
    await expect(page).toHaveURL(/\/persons\//, { timeout: 15_000 })
    await expect(page.getByText(/TESTE QA E2E|999888/).first()).toBeVisible()
    await expect(page.getByText("Histórico de Cautelas")).toBeVisible()
  })
})
