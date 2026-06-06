import { test, expect } from "@playwright/test"
import { hasSupervisorCredentials, loginAsSupervisor } from "./helpers/auth"
import { openCautelaById } from "./helpers/cautela"
import { runSeedScript } from "./helpers/seed"

test.describe("E2E-07 Etapa 5 — smoke rotas QA", () => {
  test.beforeEach(() => {
    test.skip(!hasSupervisorCredentials(), "Credenciais E2E não configuradas")
  })

  test("logout e re-login supervisor", async ({ page }) => {
    await loginAsSupervisor(page)
    await page.getByRole("button", { name: "Sair do Sistema" }).click()
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 15_000 })
    await loginAsSupervisor(page)
    await expect(page.getByRole("navigation")).toBeVisible()
  })

  test("/reports/materials carrega", async ({ page }) => {
    await loginAsSupervisor(page)
    await page.goto("/reports/materials")
    await expect(page.getByRole("heading", { name: "Relatório Detalhado de Materiais" })).toBeVisible({
      timeout: 15_000,
    })
  })

  test("/reports/cautelas carrega", async ({ page }) => {
    await loginAsSupervisor(page)
    await page.goto("/reports/cautelas")
    await expect(page.getByRole("heading", { name: "Relatório de Cautelas Ativas" })).toBeVisible({
      timeout: 15_000,
    })
  })

  test("/alerts e /history carregam", async ({ page }) => {
    await loginAsSupervisor(page)
    await page.goto("/alerts")
    await expect(page.getByRole("heading", { name: "Central de Alertas" })).toBeVisible({ timeout: 15_000 })
    await page.goto("/history")
    await expect(page.getByRole("heading", { name: "Histórico" })).toBeVisible({ timeout: 15_000 })
  })

  test("/ammo-batches carrega e CRUD smoke", async ({ page }) => {
    test.setTimeout(90_000)
    await loginAsSupervisor(page)
    await page.goto("/ammo-batches")
    await expect(page.getByText("Munição — Controle de Lotes")).toBeVisible({ timeout: 15_000 })

    const stamp = Date.now()
    const lotLabel = `E2E-QA-${stamp}`
    const marcaLabel = `CBC-E2E-${stamp}`
    await page.getByRole("button", { name: "Novo Lote" }).click()
    const modal = page
      .locator("div.fixed")
      .filter({ has: page.getByRole("heading", { name: /Novo Lote de Munição/i }) })
    await expect(modal).toBeVisible({ timeout: 10_000 })
    await modal.getByPlaceholder("Ex: 9mm, .40, .380").fill("9mm")
    await modal.getByPlaceholder("Ex: LOT-2024-001").fill(lotLabel)
    await modal.locator('input[type="number"]').fill("100")
    await modal.getByRole("button", { name: "Criar Lote" }).click()
    await expect(page.getByText("9mm").first()).toBeVisible({ timeout: 15_000 })

    const row = page.locator("tr").filter({ hasText: lotLabel }).first()
    await row.getByTitle("Editar").click()
    const editModal = page
      .locator("div.fixed")
      .filter({ has: page.getByRole("heading", { name: /Editar Lote/i }) })
    await editModal.getByPlaceholder("Ex: CBC, Sellier & Bellot").fill(marcaLabel)
    await editModal.getByRole("button", { name: "Atualizar Lote" }).click()
    await expect(row.getByText(marcaLabel)).toBeVisible({ timeout: 15_000 })

    await row.getByTitle("Excluir").click()
    const deleteModal = page
      .locator("div.fixed")
      .filter({ hasText: "Tem certeza que deseja excluir este lote de munição?" })
    await expect(deleteModal).toBeVisible()
    await deleteModal.getByRole("button", { name: "Excluir" }).click()
    await expect(page.locator("tr").filter({ hasText: lotLabel })).toHaveCount(0, { timeout: 15_000 })
  })

  test("badge Em Uso abre modal com detalhes da cautela", async ({ page }) => {
    test.setTimeout(90_000)
    const seed = runSeedScript("scripts/qa/seed-stock-partial-return.mjs")
    const chargerPatrimony = String(seed.charger_patrimony ?? "")
    test.skip(!chargerPatrimony, "seed E2E-06 incompleto")

    await loginAsSupervisor(page)
    await page.goto("/materials")
    await expect(page.getByRole("heading", { name: "Materiais" })).toBeVisible({ timeout: 15_000 })

    const searchInput = page.getByPlaceholder("Buscar por nome, patrimônio ou código...")
    await searchInput.fill(chargerPatrimony)
    const row = page.locator("tr").filter({ hasText: chargerPatrimony }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.getByRole("button", { name: "Em Uso" }).click()

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole("heading", { name: "Material em uso" })).toBeVisible()
    await expect(page.getByText("Com quem está")).toBeVisible()
    await expect(page.getByRole("link", { name: /Ver cautela completa/i })).toBeVisible()
  })

  test("deep link /cautelas?id= abre detalhes", async ({ page }) => {
    const seed = runSeedScript("scripts/qa/seed-partial-return-demo.mjs")
    const cautelaId = String(seed.cautela_id ?? "")
    test.skip(!cautelaId, "cautela_id ausente após seed")
    await loginAsSupervisor(page)
    await openCautelaById(page, cautelaId)
  })

  test("/admin e /settings retornam 404", async ({ page }) => {
    await loginAsSupervisor(page)
    for (const path of ["/admin", "/settings"]) {
      const response = await page.goto(path)
      expect(response?.status()).toBe(404)
    }
  })

  test("exports API retornam arquivo autenticado", async ({ page }) => {
    await loginAsSupervisor(page)
    for (const path of ["/api/export/materials", "/api/export/cautelas", "/api/export/divergencias"]) {
      const response = await page.request.get(path)
      expect(response.status(), `${path} status`).toBe(200)
      expect(response.headers()["content-type"], `${path} content-type`).toMatch(
        /spreadsheet|excel|octet-stream|csv/i
      )
    }
  })
})
