/**
 * Valida ausência de policies permissivas (USING true) no teste_db.
 * Uso: node scripts/qa/validate-all-rls-test.mjs
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
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json()
}

const permissive = await query(`
  SELECT tablename, policyname, cmd, qual, with_check
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      qual = 'true'
      OR with_check = 'true'
      OR policyname = 'Allow authenticated users'
    )
  ORDER BY tablename, policyname;
`)

if (permissive.length > 0) {
  console.error("Policies permissivas encontradas:")
  for (const p of permissive) {
    console.error(`  ${p.tablename}.${p.policyname} (${p.cmd}) qual=${p.qual} check=${p.with_check}`)
  }
  process.exit(1)
}

const auditPrivs = await query(`
  SELECT privilege_type
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name = 'audit_logs'
    AND grantee = 'authenticated'
    AND privilege_type IN ('UPDATE', 'DELETE');
`)

if (auditPrivs.length > 0) {
  console.error("audit_logs ainda concede UPDATE/DELETE a authenticated:", auditPrivs)
  process.exit(1)
}

console.log("Validação RLS teste_db: OK (sem policies USING true; audit_logs append-only)")
