/**
 * Checklist Etapa 3 — movimentações (teste_db).
 * Uso: node scripts/qa/validate-etapa3-movimentacoes.mjs
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

console.log("\n=== Checklist Etapa 3 — MOVIMENTAÇÕES (teste_db) ===\n")

const tables = await query(`
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'movimentacoes'
  ) AS ok;
`)
if (tables[0]?.ok) {
  console.log("✓ tabela movimentacoes")
} else {
  console.log("✗ tabela movimentacoes ausente")
  failed++
}

const enums = await query(`
  SELECT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'tipo_movimentacao'
  ) AS ok;
`)
if (enums[0]?.ok) {
  console.log("✓ ENUM tipo_movimentacao")
} else {
  console.log("✗ ENUM tipo_movimentacao ausente")
  failed++
}

const count = await query(`SELECT count(*)::int AS n FROM public.movimentacoes;`)
const total = count[0]?.n ?? 0
if (total > 0) {
  console.log(`✓ movimentacoes: ${total} linhas (backfill + operações)`)
} else {
  console.log("✗ movimentacoes vazia")
  failed++
}

const dist = await query(`
  SELECT tipo::text AS t, count(*)::int AS n
  FROM public.movimentacoes
  GROUP BY tipo
  ORDER BY n DESC
  LIMIT 8;
`)
console.log("✓ distribuição por tipo:")
for (const row of dist) {
  console.log(`    ${row.t}: ${row.n}`)
}

const privs = await query(`
  SELECT privilege_type
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name = 'movimentacoes'
    AND grantee = 'authenticated'
    AND privilege_type IN ('UPDATE', 'DELETE');
`)
if (privs.length === 0) {
  console.log("✓ movimentacoes append-only (sem UPDATE/DELETE para authenticated)")
} else {
  console.log("✗ movimentacoes ainda permite mutação:", privs)
  failed++
}

const fns = await query(`
  SELECT proname FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND proname IN (
      'aplicar_movimentacao_material',
      'registrar_movimentacao_devolucao'
    );
`)
const fnSet = new Set(fns.map((r) => r.proname))
for (const name of ["aplicar_movimentacao_material", "registrar_movimentacao_devolucao"]) {
  if (fnSet.has(name)) {
    console.log(`✓ função ${name}`)
  } else {
    console.log(`✗ função ${name} ausente`)
    failed++
  }
}

if (failed > 0) {
  console.error("\n✗ Etapa 3 — validação FALHOU\n")
  process.exit(1)
}

console.log("\n✓ Etapa 3 — movimentações OK no teste_db\n")
