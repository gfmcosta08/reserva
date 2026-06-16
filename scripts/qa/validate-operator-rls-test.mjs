/**
 * Garante que tabelas operacionais têm policy is_active_operator no teste_db.
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, "../.env.clone")
const env = {}
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const t = line.trim()
  if (!t || t.startsWith("#")) continue
  const i = t.indexOf("=")
  if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
}

const token = env.SUPABASE_ACCESS_TOKEN
const projectRef = env.SUPABASE_TEST_PROJECT_REF || "ajyvznrmbuistlcfckuh"

const required = [
  "persons_operator_rw",
  "materials_operator_rw",
  "cautelas_operator_rw",
  "cautela_items_operator_rw",
  "divergences_operator_rw",
  "audit_logs_operator_select",
  "audit_logs_operator_insert",
]

async function query(sql) {
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
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

const rows = await query(`
  SELECT policyname FROM pg_policies WHERE schemaname = 'public';
`)
const names = new Set(rows.map((r) => r.policyname))
let failed = false
for (const name of required) {
  if (!names.has(name)) {
    console.error(`FALTA: ${name}`)
    failed = true
  }
}
if (failed) process.exit(1)
console.log("RLS operacional teste_db: OK")
