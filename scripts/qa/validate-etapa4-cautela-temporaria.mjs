/**
 * Checklist Etapa 4 — cautela temporária (daily) no teste_db.
 * Uso: node scripts/qa/validate-etapa4-cautela-temporaria.mjs
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

console.log("\n=== Checklist Etapa 4 — CAUTELA TEMPORÁRIA (teste_db) ===\n")

const col = await query(`
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cautelas'
      AND column_name = 'data_prevista_devolucao'
  ) AS ok;
`)
if (col[0]?.ok) {
  console.log("✓ cautelas.data_prevista_devolucao")
} else {
  console.log("✗ coluna data_prevista_devolucao ausente")
  failed++
}

const view = await query(`
  SELECT EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public'
      AND table_name = 'v_materiais_cautela_temporaria_aberta'
  ) AS ok;
`)
if (view[0]?.ok) {
  console.log("✓ view v_materiais_cautela_temporaria_aberta")
} else {
  console.log("✗ view v_materiais_cautela_temporaria_aberta ausente")
  failed++
}

const fn = await query(`
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'calc_daily_return_deadline'
  ) AS ok;
`)
if (fn[0]?.ok) {
  console.log("✓ função calc_daily_return_deadline")
} else {
  console.log("✗ função calc_daily_return_deadline ausente")
  failed++
}

const dailyBackfill = await query(`
  SELECT count(*)::int AS total,
         count(*) FILTER (WHERE data_prevista_devolucao IS NOT NULL)::int AS com_prazo
  FROM public.cautelas
  WHERE type = 'daily';
`)
const dTotal = dailyBackfill[0]?.total ?? 0
const dComPrazo = dailyBackfill[0]?.com_prazo ?? 0
if (dTotal === 0 || dComPrazo === dTotal) {
  console.log(`✓ cautelas daily com prazo: ${dComPrazo}/${dTotal}`)
} else {
  console.log(`✗ cautelas daily sem prazo: ${dTotal - dComPrazo} de ${dTotal}`)
  failed++
}

const openDailyItems = await query(`
  SELECT ci.id AS cautela_item_id, c.id AS cautela_id
  FROM public.cautelas c
  JOIN public.cautela_items ci ON ci.cautela_id = c.id
  WHERE c.type = 'daily'
    AND c.status IN ('open', 'partial')
    AND ci.status = 'pending'
    AND COALESCE(ci.quantity_returned, 0) < ci.quantity_delivered
  LIMIT 20;
`)

const sampleCount = openDailyItems.length
console.log(`✓ amostra cautelas daily abertas (itens pendentes): ${sampleCount}`)

if (sampleCount > 0) {
  const ids = openDailyItems.map((r) => `'${r.cautela_item_id}'`).join(",")
  const movCheck = await query(`
    SELECT ci.id AS cautela_item_id,
           EXISTS (
             SELECT 1 FROM public.movimentacoes mv
             WHERE mv.cautela_item_id = ci.id
               AND mv.tipo = 'CAUTELA_SAIDA'
           ) AS tem_saida
    FROM public.cautela_items ci
    WHERE ci.id IN (${ids});
  `)
  const missing = movCheck.filter((r) => !r.tem_saida)
  if (missing.length === 0) {
    console.log(`✓ todos os ${sampleCount} itens abertos têm movimentação CAUTELA_SAIDA`)
  } else {
    console.log(`✗ ${missing.length} item(ns) sem CAUTELA_SAIDA`)
    failed++
  }
}

const viewSample = await query(`
  SELECT count(*)::int AS n FROM public.v_materiais_cautela_temporaria_aberta;
`)
console.log(`✓ view retorna ${viewSample[0]?.n ?? 0} materiais em cautela temporária aberta`)

const idx = await query(`
  SELECT indexname FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'cautelas'
    AND indexname = 'idx_cautelas_daily_open_deadline';
`)
if (idx.length > 0) {
  console.log("✓ índice idx_cautelas_daily_open_deadline")
} else {
  console.log("✗ índice idx_cautelas_daily_open_deadline ausente")
  failed++
}

if (failed > 0) {
  console.error("\n✗ Etapa 4 — validação FALHOU\n")
  process.exit(1)
}

console.log("\n✓ Etapa 4 — cautela temporária OK no teste_db\n")
