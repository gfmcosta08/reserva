/**
 * Valida policies RBAC de profiles no teste_db (pós SEC-05).
 * Uso: node scripts/qa/validate-profiles-rls-test.mjs
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, "../.env.clone")

if (!existsSync(envPath)) {
  console.error("scripts/.env.clone necessário")
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
if (!token) throw new Error("SUPABASE_ACCESS_TOKEN ausente")

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
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status} ${text}`)
  }
  return res.json()
}

const policies = await query(`
  SELECT policyname, cmd
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'profiles'
  ORDER BY policyname;
`)

const names = new Set(policies.map((p) => p.policyname))
const required = [
  "profiles_self_read",
  "profiles_operator_select",
  "profiles_supervisor_insert",
  "profiles_supervisor_update",
  "profiles_supervisor_delete",
]
const forbidden = ["profiles_operator_rw", "Allow authenticated users"]

let failed = false
for (const name of required) {
  if (!names.has(name)) {
    console.error(`FALTA policy: ${name}`)
    failed = true
  }
}
for (const name of forbidden) {
  if (names.has(name)) {
    console.error(`POLICY PERIGOSA ainda presente: ${name}`)
    failed = true
  }
}

const fn = await query(`
  SELECT proname
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND proname IN ('is_supervisor', 'is_active_operator');
`)

const fnNames = new Set(fn.map((r) => r.proname))
if (!fnNames.has("is_supervisor")) {
  console.error("FALTA função is_supervisor()")
  failed = true
}

if (failed) {
  console.error("Validação SEC-05 profiles RLS: FALHOU")
  process.exit(1)
}

console.log("Validação SEC-05 profiles RLS: OK")
console.log("Policies:", [...names].sort().join(", "))
