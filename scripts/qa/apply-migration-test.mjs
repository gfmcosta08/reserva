/**
 * Aplica uma migration SQL no teste_db via Supabase Management API.
 * Uso: node scripts/qa/apply-migration-test.mjs supabase/migrations/20260608130000_profiles_rbac_rls.sql
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, "../.env.clone")
const migrationArg = process.argv[2]

if (!migrationArg) {
  console.error("Uso: node scripts/qa/apply-migration-test.mjs <caminho-migration.sql>")
  process.exit(1)
}

const migrationPath = resolve(process.cwd(), migrationArg)
if (!existsSync(migrationPath)) {
  console.error(`Migration não encontrada: ${migrationPath}`)
  process.exit(1)
}
if (!existsSync(envPath)) {
  console.error("scripts/.env.clone necessário (SUPABASE_ACCESS_TOKEN + SUPABASE_TEST_PROJECT_REF)")
  process.exit(1)
}

const env = {}
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const t = line.trim()
  if (!t || t.startsWith("#")) continue
  const i = t.indexOf("=")
  if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
}

const token = env.SUPABASE_ACCESS_TOKEN
const projectRef = env.SUPABASE_TEST_PROJECT_REF || "ajyvznrmbuistlcfckuh"
if (!token) throw new Error("SUPABASE_ACCESS_TOKEN ausente em scripts/.env.clone")

const sql = readFileSync(migrationPath, "utf8")
const fileName = migrationArg.split(/[/\\]/).pop()

console.log(`Applying ${fileName} to teste_db (${projectRef})...`)

const res = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  }
)

if (!res.ok) {
  const text = await res.text()
  throw new Error(`Apply failed (${res.status}): ${text}`)
}

console.log("OK — migration aplicada no teste_db")
