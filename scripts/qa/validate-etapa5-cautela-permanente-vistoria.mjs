/**
 * Checklist Etapa 5 — cautela permanente / vistoria anual no teste_db.
 * Uso: node scripts/qa/validate-etapa5-cautela-permanente-vistoria.mjs
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

console.log("\n=== Checklist Etapa 5 — CAUTELA PERMANENTE / VISTORIA (teste_db) ===\n")

const fnReview = await query(`
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'calc_annual_review_date'
  ) AS ok;
`)
if (fnReview[0]?.ok) {
  console.log("✓ função calc_annual_review_date")
} else {
  console.log("✗ função calc_annual_review_date ausente")
  failed++
}

const fnVistoria = await query(`
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'registrar_vistoria'
  ) AS ok;
`)
if (fnVistoria[0]?.ok) {
  console.log("✓ função registrar_vistoria")
} else {
  console.log("✗ função registrar_vistoria ausente")
  failed++
}

for (const viewName of ["v_vistorias_pendentes", "v_vistorias_atrasadas"]) {
  const view = await query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.views
      WHERE table_schema = 'public' AND table_name = '${viewName}'
    ) AS ok;
  `)
  if (view[0]?.ok) {
    console.log(`✓ view ${viewName}`)
  } else {
    console.log(`✗ view ${viewName} ausente`)
    failed++
  }
}

const tipoVistoria = await query(`
  SELECT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'tipo_movimentacao'
      AND e.enumlabel = 'VISTORIA'
  ) AS ok;
`)
if (tipoVistoria[0]?.ok) {
  console.log("✓ tipo_movimentacao VISTORIA")
} else {
  console.log("✗ enum VISTORIA ausente")
  failed++
}

const permanentBackfill = await query(`
  SELECT count(*)::int AS total,
         count(*) FILTER (WHERE review_date IS NOT NULL)::int AS com_review
  FROM public.cautelas
  WHERE type = 'permanent' AND status IN ('open', 'partial');
`)
const pTotal = permanentBackfill[0]?.total ?? 0
const pComReview = permanentBackfill[0]?.com_review ?? 0
if (pTotal === 0 || pComReview === pTotal) {
  console.log(`✓ cautelas permanentes abertas com review_date: ${pComReview}/${pTotal}`)
} else {
  console.log(`✗ permanentes abertas sem review_date: ${pTotal - pComReview} de ${pTotal}`)
  failed++
}

const rpcSig = await query(`
  SELECT pg_get_function_identity_arguments(p.oid) AS args
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'create_cautela_atomic';
`)
const hasReviewParam = rpcSig.some((r) => String(r.args).includes("p_review_date"))
if (hasReviewParam) {
  console.log("✓ create_cautela_atomic aceita p_review_date")
} else {
  console.log("✗ create_cautela_atomic sem p_review_date")
  failed++
}

const pendingCount = await query(`SELECT count(*)::int AS n FROM public.v_vistorias_pendentes;`)
const overdueCount = await query(`SELECT count(*)::int AS n FROM public.v_vistorias_atrasadas;`)
console.log(`✓ view pendentes: ${pendingCount[0]?.n ?? 0} | atrasadas: ${overdueCount[0]?.n ?? 0}`)

const idx = await query(`
  SELECT indexname FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'cautelas'
    AND indexname = 'idx_cautelas_permanent_review_date';
`)
if (idx.length > 0) {
  console.log("✓ índice idx_cautelas_permanent_review_date")
} else {
  console.log("✗ índice idx_cautelas_permanent_review_date ausente")
  failed++
}

if (failed > 0) {
  console.error("\n✗ Etapa 5 — validação FALHOU\n")
  process.exit(1)
}

console.log("\n✓ Etapa 5 — cautela permanente / vistoria OK no teste_db\n")
