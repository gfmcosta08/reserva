/**
 * Checklist Etapa 6 — inventário físico no teste_db.
 * Uso: node scripts/qa/validate-etapa6-inventario.mjs
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

let failed = 0

console.log("\n=== Checklist Etapa 6 — INVENTÁRIO FÍSICO (teste_db) ===\n")

for (const table of ["inventarios", "inventario_itens"]) {
  const t = await query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = '${table}'
    ) AS ok;
  `)
  if (t[0]?.ok) {
    console.log(`✓ tabela ${table}`)
  } else {
    console.log(`✗ tabela ${table} ausente`)
    failed++
  }
}

for (const enumName of ["inventario_status", "inventario_item_status"]) {
  const e = await query(`
    SELECT EXISTS (
      SELECT 1 FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typname = '${enumName}'
    ) AS ok;
  `)
  if (e[0]?.ok) {
    console.log(`✓ enum ${enumName}`)
  } else {
    console.log(`✗ enum ${enumName} ausente`)
    failed++
  }
}

const fn = await query(`
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fechar_inventario'
  ) AS ok;
`)
if (fn[0]?.ok) {
  console.log("✓ função fechar_inventario")
} else {
  console.log("✗ função fechar_inventario ausente")
  failed++
}

for (const [table, policy] of [
  ["inventarios", "inventarios_reserva_scoped_rw"],
  ["inventario_itens", "inventario_itens_reserva_scoped_rw"],
]) {
  const pol = await query(`
    SELECT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = '${table}' AND policyname = '${policy}'
    ) AS ok;
  `)
  if (pol[0]?.ok) {
    console.log(`✓ RLS ${policy}`)
  } else {
    console.log(`✗ RLS ${policy} ausente`)
    failed++
  }
}

for (const idx of [
  "inventarios_reserva_id_idx",
  "inventarios_status_idx",
  "inventario_itens_material_id_idx",
]) {
  const r = await query(`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = '${idx}';
  `)
  if (r.length > 0) {
    console.log(`✓ índice ${idx}`)
  } else {
    console.log(`✗ índice ${idx} ausente`)
    failed++
  }
}

const cols = await query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'inventarios'
  ORDER BY column_name;
`)
const requiredCols = [
  "id", "reserva_id", "unit_id", "organization_id", "operador_id",
  "status", "started_at", "closed_at", "observacao",
]
const present = new Set(cols.map((c) => c.column_name))
const missing = requiredCols.filter((c) => !present.has(c))
if (missing.length === 0) {
  console.log("✓ colunas inventarios completas")
} else {
  console.log(`✗ colunas inventarios faltando: ${missing.join(", ")}`)
  failed++
}

if (failed > 0) {
  console.error("\n✗ Etapa 6 — validação FALHOU\n")
  process.exit(1)
}

console.log("\n✓ Etapa 6 — inventário físico OK no teste_db\n")
