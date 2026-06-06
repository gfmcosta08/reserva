import { expect, type Page } from "@playwright/test"

export const e2ePersonMatricula = process.env.E2E_PERSON_MATRICULA ?? "999888"
export const e2ePersonPin = process.env.E2E_PERSON_PIN ?? "5678"
export const jhonnyMatricula = process.env.E2E_JHONNY_MATRICULA ?? "064272"
export const e2eHtPatrimony = process.env.E2E_HT_PATRIMONY ?? "PAT-E2E-HT-001"

export async function openCautelaById(page: Page, cautelaId: string): Promise<void> {
  await page.goto(`/cautelas?id=${cautelaId}`)
  await expect(page.getByRole("heading", { name: "Detalhes da Cautela" })).toBeVisible({ timeout: 15_000 })
}

export async function openCautelasPage(page: Page): Promise<void> {
  await page.getByRole("navigation").getByRole("link", { name: "Cautelas", exact: true }).click()
  await expect(page).toHaveURL(/\/cautelas/, { timeout: 15_000 })
  await expect(page.getByRole("heading", { name: "Cautelas" })).toBeVisible()
}

export async function startNovaCautela(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Nova Cautela" }).click()
  await expect(page.getByRole("heading", { name: "Nova Cautela" })).toBeVisible()
}

export async function selectPersonByMatricula(page: Page, matricula: string): Promise<void> {
  await page.getByPlaceholder("Buscar pessoa...").fill(matricula)
  const result = page.getByRole("button").filter({ hasText: `Matrícula: ${matricula}` })
  await expect(result.first()).toBeVisible({ timeout: 15_000 })
  await result.first().click()
}

export async function addHtToCautela(page: Page, searchTerm: string): Promise<void> {
  const htInput = page.getByRole("textbox", { name: "Código do rádio" })
  await htInput.scrollIntoViewIfNeeded()
  await htInput.fill(searchTerm)
  const result = page.locator("ul.absolute.z-20 button").filter({ hasText: /HT QA E2E|PAT-E2E-HT/i })
  await expect(result.first()).toBeVisible({ timeout: 15_000 })
  await result.first().click()
  await expect(page.getByText(/incluído no resumo/i).first()).toBeVisible({ timeout: 10_000 })
}

export async function addPistolOnlyToCautela(page: Page, weaponSearch: string): Promise<void> {
  const pistolInput = page.getByRole("textbox", { name: /Patrimônio, serial, código — só pistolas/i })
  await pistolInput.scrollIntoViewIfNeeded()
  await pistolInput.fill(weaponSearch)
  const result = page.locator("ul.absolute.z-20 button").first()
  await expect(result).toBeVisible({ timeout: 15_000 })
  await result.click()
  await page.getByRole("button", { name: /Incluir só a pistola/i }).click()
  await expect(page.getByText(/Selecionada:/i)).toBeVisible()
}

export async function goToCautelaSummary(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Próximo: Resumo/i }).click()
  await expect(page.getByRole("heading", { name: "Resumo da Cautela" })).toBeVisible()
}

export async function confirmDailyCautela(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Diária", exact: true }).click()
  await page.getByRole("button", { name: /Próximo: (PIN|Assinatura)/i }).click()
}

export async function enterPersonPin(page: Page, pin: string): Promise<void> {
  const usePin = page.getByRole("button", { name: "Usar PIN" })
  if (await usePin.isVisible().catch(() => false)) {
    await usePin.click()
  }
  await expect(page.getByRole("heading", { name: "Validar PIN" })).toBeVisible({ timeout: 10_000 })
  const keypad = page.locator(".grid.grid-cols-3.gap-2")
  for (const digit of pin) {
    await keypad.getByRole("button", { name: digit, exact: true }).click()
  }
  await keypad.locator("button").last().click()
}

export async function createDailyCautelaWithPistol(
  page: Page,
  matricula: string,
  pin: string,
  weaponSearch = "Glock"
): Promise<void> {
  await openCautelasPage(page)
  await startNovaCautela(page)
  await selectPersonByMatricula(page, matricula)
  await page.getByRole("button", { name: /Próximo: Materiais/i }).click()
  await expect(page.getByRole("heading", { name: "Materiais" })).toBeVisible()
  await addPistolOnlyToCautela(page, weaponSearch)
  await goToCautelaSummary(page)
  await confirmDailyCautela(page)
  await enterPersonPin(page, pin)
  await expect(page.getByRole("heading", { name: "Nova Cautela" })).not.toBeVisible({ timeout: 30_000 })
}

export async function createDailyCautelaWithHt(
  page: Page,
  matricula: string,
  pin: string,
  htSearch = e2eHtPatrimony
): Promise<void> {
  await openCautelasPage(page)
  await startNovaCautela(page)
  await selectPersonByMatricula(page, matricula)
  await page.getByRole("button", { name: /Próximo: Materiais/i }).click()
  await expect(page.getByRole("heading", { name: "Materiais" })).toBeVisible()
  await addHtToCautela(page, htSearch)
  await goToCautelaSummary(page)
  await confirmDailyCautela(page)
  await enterPersonPin(page, pin)
  await expect(page.getByRole("heading", { name: "Nova Cautela" })).not.toBeVisible({ timeout: 30_000 })
}

export async function startReturnFlow(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Continuar devolução/i }).click()
  await expect(page.getByRole("heading", { name: "Devolução de Itens" })).toBeVisible()
  await expect(page.getByRole("heading", { name: /Itens cautelados/i })).toBeVisible()
}

export async function finalizeReturn(page: Page, expectedModes = 1): Promise<void> {
  const conferidos = page
    .locator("div.flex-1")
    .filter({ has: page.getByText("Modo escolhido", { exact: true }) })
    .locator("p.text-lg.font-bold.text-green-400")
  await expect(conferidos).toHaveText(String(expectedModes), { timeout: 15_000 })
  const submit = page.getByRole("button", { name: "Finalizar devolução" })
  await submit.click()
  const success = page.getByText(/Devolução registrada/i)
  try {
    await expect(success).toBeVisible({ timeout: 8_000 })
  } catch {
    await submit.click()
    await expect(success).toBeVisible({ timeout: 20_000 })
  }
}

function returnCards(page: Page) {
  return page.locator("div.p-4.rounded-xl.border")
}

function returnItemCard(page: Page, materialNamePattern: RegExp | string) {
  const pattern =
    typeof materialNamePattern === "string" ? materialNamePattern : materialNamePattern
  return page.locator("div.p-4.rounded-xl.border").filter({ hasText: pattern }).first()
}

function bucketSection(page: Page, bucketHeading: RegExp) {
  return page
    .locator("p.text-\\[10px\\].font-bold.text-slate-500")
    .filter({ hasText: bucketHeading })
    .locator("xpath=..")
}

export async function setReturnModeOnCardIndex(
  page: Page,
  index: number,
  mode: "Devolver total" | "Devolver parcial"
): Promise<void> {
  const card = returnCards(page).nth(index)
  await expect(card).toBeVisible({ timeout: 10_000 })
  await card.scrollIntoViewIfNeeded()
  await card.getByRole("button", { name: mode, exact: true }).click()
}

export async function setPartialReturnOnCardIndex(page: Page, index: number, qty: number): Promise<void> {
  const card = returnCards(page).nth(index)
  await expect(card).toBeVisible({ timeout: 10_000 })
  await card.scrollIntoViewIfNeeded()
  await card.getByRole("button", { name: "Devolver parcial", exact: true }).click()
  const input = card.locator('input[type="number"]')
  await expect(input).toBeVisible({ timeout: 5_000 })
  await input.fill(String(qty))
  await expect(input).toHaveValue(String(qty))
}

export async function setPartialReturnInBucket(page: Page, bucketHeading: RegExp, qty: number): Promise<void> {
  const section = bucketSection(page, bucketHeading)
  const card = section.locator("div.p-4.rounded-xl.border").first()
  await expect(card).toBeVisible({ timeout: 10_000 })
  await card.scrollIntoViewIfNeeded()
  await card.getByRole("button", { name: "Devolver parcial", exact: true }).click()
  const input = card.locator('input[type="number"]')
  await expect(input).toBeVisible({ timeout: 5_000 })
  await input.fill(String(qty))
  await expect(input).toHaveValue(String(qty))
  await expect(card).toHaveClass(/yellow-500/)
}

export async function setReturnModeInBucket(
  page: Page,
  bucketHeading: RegExp,
  mode: "Devolver total" | "Devolver parcial"
): Promise<void> {
  const section = bucketSection(page, bucketHeading)
  const card = section.locator("div.p-4.rounded-xl.border").first()
  await expect(card).toBeVisible({ timeout: 10_000 })
  await card.getByRole("button", { name: mode, exact: true }).click()
}

export async function setReturnModeOnItem(
  page: Page,
  materialNamePattern: RegExp | string,
  mode: "Devolver total" | "Devolver parcial"
): Promise<void> {
  const card = returnItemCard(page, materialNamePattern)
  await expect(card).toBeVisible({ timeout: 10_000 })
  await card.scrollIntoViewIfNeeded()
  await card.getByRole("button", { name: mode, exact: true }).click()
}

export async function setPartialReturnQty(
  page: Page,
  materialNamePattern: RegExp | string,
  qty: number
): Promise<void> {
  const card = returnItemCard(page, materialNamePattern)
  await expect(card).toBeVisible({ timeout: 10_000 })
  await card.scrollIntoViewIfNeeded()
  await card.getByRole("button", { name: "Devolver parcial", exact: true }).click()
  const input = card.locator('input[type="number"]')
  await expect(input).toBeVisible({ timeout: 5_000 })
  await input.click()
  await input.fill(String(qty))
  await expect(input).toHaveValue(String(qty))
}
