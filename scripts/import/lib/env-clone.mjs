import { readFileSync, existsSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

export function loadCloneEnv() {
  const envPath = resolve(__dirname, "../../.env.clone")
  if (!existsSync(envPath)) {
    throw new Error("scripts/.env.clone não encontrado (copie de scripts/env.clone.example)")
  }
  const env = {}
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const i = t.indexOf("=")
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return env
}

export const TEST_REF = "ajyvznrmbuistlcfckuh"

export function assertTestOnly(url) {
  if (!url || !url.includes(TEST_REF)) {
    throw new Error(`Abortado: URL deve ser teste_bd (${TEST_REF}). Produção bloqueada.`)
  }
}

export function placeholderEmail(registration_number) {
  return `pendente+${registration_number}@cadastro.reserva.local`
}
