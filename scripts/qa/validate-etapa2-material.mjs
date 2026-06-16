/**
 * Checklist Etapa 2 — entidade MATERIAL (teste_db).
 * Uso: node scripts/qa/validate-etapa2-material.mjs
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

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
const url = env.SUPABASE_TEST_URL || `https://${projectRef}.supabase.co`
const serviceKey = env.SUPABASE_TEST_SERVICE_ROLE_KEY

if (!token) throw new Error("SUPABASE_ACCESS_TOKEN ausente")
if (!serviceKey) throw new Error("SUPABASE_TEST_SERVICE_ROLE_KEY ausente")

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

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

let failed = 0

console.log("\n=== Checklist Etapa 2 — MATERIAL (teste_db) ===\n")

const enums = await query(`
  SELECT t.typname
  FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public'
    AND t.typname IN ('status_material', 'tipo_material');
`)

const enumNames = new Set(enums.map((r) => r.typname))
for (const name of ["status_material", "tipo_material"]) {
  if (enumNames.has(name)) {
    console.log(`✓ ENUM ${name}`)
  } else {
    console.log(`✗ ENUM ${name} ausente`)
    failed++
  }
}

const cols = await query(`
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'materials'
    AND column_name IN ('status_atual', 'tipo_material', 'person_responsavel_id', 'localizacao_atual', 'reserva_id');
`)

const colSet = new Set(cols.map((r) => r.column_name))
for (const col of [
  "status_atual",
  "tipo_material",
  "person_responsavel_id",
  "localizacao_atual",
  "reserva_id",
]) {
  if (colSet.has(col)) {
    console.log(`✓ materials.${col}`)
  } else {
    console.log(`✗ materials.${col} ausente`)
    failed++
  }
}

const nullStatus = await query(`
  SELECT count(*)::int AS n FROM public.materials WHERE status_atual IS NULL;
`)
if (nullStatus[0]?.n === 0) {
  console.log("✓ materials: todas as linhas com status_atual")
} else {
  console.log(`✗ materials: ${nullStatus[0]?.n} sem status_atual`)
  failed++
}

const nullTipo = await query(`
  SELECT count(*)::int AS n FROM public.materials WHERE tipo_material IS NULL;
`)
if (nullTipo[0]?.n === 0) {
  console.log("✓ materials: todas as linhas com tipo_material")
} else {
  console.log(`✗ materials: ${nullTipo[0]?.n} sem tipo_material`)
  failed++
}

const dist = await query(`
  SELECT status_atual::text AS s, count(*)::int AS n
  FROM public.materials
  GROUP BY status_atual
  ORDER BY n DESC;
`)
console.log("✓ distribuição status_atual:")
for (const row of dist) {
  console.log(`    ${row.s}: ${row.n}`)
}

const fn = await query(`
  SELECT proname FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND proname = 'verificar_disponibilidade_material';
`)
if (fn.length > 0) {
  console.log("✓ função verificar_disponibilidade_material")
} else {
  console.log("✗ função verificar_disponibilidade_material ausente")
  failed++
}

const { count: disponivel } = await admin
  .from("materials")
  .select("id", { count: "exact", head: true })
  .eq("status_atual", "DISPONIVEL")

console.log(`✓ materiais DISPONIVEL: ${disponivel ?? 0}`)

if (failed > 0) {
  console.error("\n✗ Etapa 2 — validação FALHOU\n")
  process.exit(1)
}

console.log("\n✓ Etapa 2 — entidade MATERIAL OK no teste_db\n")
