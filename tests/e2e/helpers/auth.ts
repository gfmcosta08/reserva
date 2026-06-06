import { expect, type Page } from "@playwright/test"

export const supervisorEmail = process.env.E2E_SUPERVISOR_EMAIL
export const supervisorPassword = process.env.E2E_SUPERVISOR_PASSWORD

export function hasSupervisorCredentials(): boolean {
  return Boolean(supervisorEmail && supervisorPassword)
}

export async function loginAsSupervisor(page: Page): Promise<void> {
  if (!supervisorEmail || !supervisorPassword) {
    throw new Error("Defina E2E_SUPERVISOR_EMAIL e E2E_SUPERVISOR_PASSWORD")
  }

  await page.goto("/auth/login")
  await expect(page.getByRole("heading", { name: "RESERVA" })).toBeVisible()
  await page.getByPlaceholder("operador@reserva.gov").fill(supervisorEmail)
  await page.getByPlaceholder("••••••••").fill(supervisorPassword)
  await page.getByRole("button", { name: "Acessar Sistema" }).click()
  await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 15_000 })
  await page.getByRole("navigation").waitFor({ state: "visible" })
}
