import { test, expect } from "@playwright/test"
import { hasSupervisorCredentials, loginAsSupervisor } from "./helpers/auth"

test.describe("E2E-10 Sistema completo — inventário e exports UI", () => {
  test.beforeEach(() => {
    test.skip(!hasSupervisorCredentials(), "Credenciais E2E não configuradas")
  })

  test("inventário físico — listagem e criar sessão", async ({ page }) => {
    test.setTimeout(90_000)
    await loginAsSupervisor(page)
    await page.goto("/inventario")
    await expect(page.getByRole("heading", { name: "Inventário Físico" })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole("button", { name: "Novo inventário" })).toBeVisible()

    await page.getByRole("button", { name: "Novo inventário" }).click()
    await expect(page).toHaveURL(/\/inventario\//, { timeout: 20_000 })
    await expect(page.getByText("Total").first()).toBeVisible()
    await expect(page.getByText("Conferidos").first()).toBeVisible()
  })

  test("relatórios — export CSV e Excel via botões na UI", async ({ page }) => {
    test.setTimeout(120_000)
    await loginAsSupervisor(page)

    await page.goto("/reports/materials")
    await expect(page.getByRole("heading", { name: "Relatório Detalhado de Materiais" })).toBeVisible({
      timeout: 15_000,
    })
    const [csvDownload] = await Promise.all([
      page.waitForEvent("download", { timeout: 30_000 }),
      page.getByRole("button", { name: /Exportar Relatório CSV/i }).click(),
    ])
    expect(csvDownload.suggestedFilename()).toMatch(/\.csv$/i)

    const [xlsxDownload] = await Promise.all([
      page.waitForEvent("download", { timeout: 30_000 }),
      page.getByRole("button", { name: /Exportar Excel/i }).first().click(),
    ])
    expect(xlsxDownload.suggestedFilename()).toMatch(/\.xlsx$/i)

    await page.goto("/reports/cautelas")
    await expect(page.getByRole("heading", { name: "Relatório de Cautelas Ativas" })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole("button", { name: /Exportar/i }).first()).toBeVisible()

    await page.goto("/reports/divergencias")
    await expect(page.getByRole("heading", { name: "Relatório de Divergências" })).toBeVisible({
      timeout: 15_000,
    })
    const divExport = page.getByRole("button", { name: /Exportar CSV/i })
    await expect(divExport).toBeVisible()
    if (await divExport.isEnabled()) {
      await divExport.click()
    }
  })

  test("navegação completa do menu supervisor", async ({ page }) => {
    test.setTimeout(120_000)
    await loginAsSupervisor(page)

    const links = [
      { name: "Dashboard", heading: "Dashboard" },
      { name: "Materiais", heading: "Materiais" },
      { name: "Pessoas", heading: "Gestão de Pessoas" },
      { name: "Cautelas", heading: "Cautelas" },
      { name: "Inventário", heading: "Inventário Físico" },
      { name: "Histórico", heading: "Histórico" },
      { name: "Central de Alertas", heading: "Central de Alertas" },
      { name: "Divergências", heading: "Relatório de Divergências" },
    ]

    for (const { name, heading } of links) {
      await page.getByRole("navigation").getByRole("link", { name, exact: true }).click()
      await expect(page.getByRole("heading", { name: heading })).toBeVisible({ timeout: 15_000 })
    }
  })
})
