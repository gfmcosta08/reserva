/**
 * Checklist Etapa 7 — dashboard/relatórios (teste_db).
 * Uso: node scripts/qa/validate-etapa7-dashboard.mjs
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

console.log("\n=== Checklist Etapa 7 — DASHBOARD/RELATÓRIOS (teste_db) ===\n")

for (const view of ["v_dashboard_kpis_reserva", "v_dashboard_alertas_resumo"]) {
  const rows = await query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.views
      WHERE table_schema = 'public' AND table_name = '${view}'
    ) AS ok;
  `)
  if (rows[0]?.ok) {
    console.log(`✓ view ${view}`)
  } else {
    console.log(`✗ view ${view} ausente`)
    failed++
  }
}

const kpi = await query(`SELECT count(*)::int AS n FROM public.v_dashboard_kpis_reserva;`)
if ((kpi[0]?.n ?? 0) >= 1) {
  console.log(`✓ v_dashboard_kpis_reserva: ${kpi[0].n} reserva(s)`)
} else {
  console.log("✗ v_dashboard_kpis_reserva vazia")
  failed++
}

const sample = await query(`
  SELECT total_materiais, disponiveis, cautelados
  FROM public.v_dashboard_kpis_reserva
  LIMIT 1;
`)
if (sample[0]?.total_materiais > 0) {
  console.log(
    `✓ amostra KPI: ${sample[0].total_materiais} materiais, ${sample[0].disponiveis} disponíveis`
  )
} else {
  console.log("✗ amostra KPI inválida")
  failed++
}

if (failed > 0) {
  console.error("\n✗ Etapa 7 — validação FALHOU\n")
  process.exit(1)
}

console.log("\n✓ Etapa 7 — dashboard/relatórios OK no teste_db\n")
