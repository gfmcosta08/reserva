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

  test("/ammo-batches carrega", async ({ page }) => {
    await loginAsSupervisor(page)
    await page.goto("/ammo-batches")
    await expect(page.getByText("Munição — Controle de Lotes")).toBeVisible({ timeout: 15_000 })
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

  test("export materials retorna arquivo autenticado", async ({ page }) => {
    await loginAsSupervisor(page)
    const response = await page.request.get("/api/export/materials")
    expect(response.status()).toBe(200)
    expect(response.headers()["content-type"]).toMatch(/spreadsheet|excel|octet-stream/i)
  })
})
