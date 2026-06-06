import { readFileSync, existsSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

const ENV_KEYS = [
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_PROD_PROJECT_REF",
  "SUPABASE_PROD_URL",
  "SUPABASE_PROD_SERVICE_ROLE_KEY",
  "SUPABASE_TEST_PROJECT_REF",
  "SUPABASE_TEST_URL",
  "SUPABASE_TEST_ANON_KEY",
  "SUPABASE_TEST_SERVICE_ROLE_KEY",
]

function parseEnvFile(path) {
  const env = {}
  if (!existsSync(path)) return env
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const i = t.indexOf("=")
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return env
}

/** Carrega scripts/.env.clone; em CI, variáveis de ambiente têm precedência. */
export function loadCloneEnv() {
  const envPath = resolve(__dirname, "../../.env.clone")
  const env = parseEnvFile(envPath)

  for (const key of ENV_KEYS) {
    const fromEnv = process.env[key]?.trim()
    if (fromEnv) env[key] = fromEnv
  }

  const ref = env.SUPABASE_TEST_PROJECT_REF
  if (!env.SUPABASE_TEST_URL && ref) {
    env.SUPABASE_TEST_URL = `https://${ref}.supabase.co`
  }

  if (!env.SUPABASE_TEST_URL || !env.SUPABASE_TEST_SERVICE_ROLE_KEY) {
    const hint = existsSync(envPath)
      ? "preencha SUPABASE_TEST_URL e SUPABASE_TEST_SERVICE_ROLE_KEY"
      : "scripts/.env.clone ausente — use env vars ou copie de scripts/env.clone.example"
    throw new Error(`Credenciais teste_db incompletas (${hint})`)
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
