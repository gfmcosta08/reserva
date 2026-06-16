/**
 * Checklist Etapa 8 — importação legado cautelados (teste_db).
 * Uso: node scripts/qa/validate-etapa8-import.mjs
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "../..")
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
function ok(msg) {
  console.log(`✓ ${msg}`)
}
function fail(msg) {
  console.log(`✗ ${msg}`)
  failed++
}

console.log("\n=== Checklist Etapa 8 — IMPORT LEGADO (teste_db) ===\n")

const parsedPath = resolve(root, "scripts/import/cautelados-1bpm.parsed.json")
if (existsSync(parsedPath)) {
  const parsed = JSON.parse(readFileSync(parsedPath, "utf8"))
  ok(`parsed JSON: ${parsed.rows?.length ?? 0} linhas (${parsed.sourceFile ?? "?"})`)
} else {
  fail("cautelados-1bpm.parsed.json ausente — rode parse-cautelados-docx.mjs")
}

const dryRun = spawnSync("node", ["scripts/import/import-cautelados-test.mjs"], {
  cwd: root,
  encoding: "utf8",
  timeout: 120000,
})

if (dryRun.status === 0) {
  ok("dry-run import-cautelados-test.mjs")
  const reportPath = resolve(root, "scripts/import/dry-run-report.md")
  if (existsSync(reportPath)) {
    const report = readFileSync(reportPath, "utf8")
    const mNotFound = report.match(/\| Materiais não encontrados \| (\d+) \|/)
    const mErrors = report.match(/\| Erros \| (\d+) \|/)
    if (mNotFound) ok(`dry-run materiais não encontrados: ${mNotFound[1]}`)
    if (mErrors && Number(mErrors[1]) === 0) ok("dry-run sem erros")
    else if (mErrors) fail(`dry-run erros: ${mErrors[1]}`)
  }
} else {
  fail(`dry-run falhou: ${dryRun.stderr?.slice(0, 200) ?? dryRun.stdout?.slice(0, 200)}`)
}

const importCautelas = await query(`
  SELECT COUNT(*)::int AS n
  FROM public.cautelas
  WHERE notes ILIKE '%Importação legado%'
    AND type = 'permanent'
    AND status IN ('open', 'partial');
`)
const nImport = importCautelas[0]?.n ?? 0
if (nImport > 0) ok(`cautelas permanentes importadas abertas: ${nImport}`)
else fail("nenhuma cautela de import legado aberta (esperado > 0 em teste_db pós-import)")

const movLink = await query(`
  SELECT COUNT(DISTINCT c.id)::int AS cautelas_com_mov
  FROM public.cautelas c
  JOIN public.movimentacoes m ON m.cautela_id = c.id
  WHERE c.notes ILIKE '%Importação legado%';
`)
const nMov = movLink[0]?.cautelas_com_mov ?? 0
if (nMov > 0) ok(`${nMov} cautela(s) import com movimentações vinculadas`)
else fail("cautelas import sem movimentacoes — rode import com --apply ou backfill etapa3")

const personsReserva = await query(`
  SELECT
    COUNT(*) FILTER (WHERE email LIKE 'pendente+%@cadastro.reserva.local')::int AS import_persons,
    COUNT(*) FILTER (
      WHERE email LIKE 'pendente+%@cadastro.reserva.local' AND reserva_id IS NOT NULL
    )::int AS with_reserva
  FROM public.persons;
`)
const imp = personsReserva[0]?.import_persons ?? 0
const withR = personsReserva[0]?.with_reserva ?? 0
if (imp === 0 || withR === imp) ok(`persons import com reserva_id: ${withR}/${imp}`)
else fail(`persons import sem reserva_id: ${imp - withR}/${imp}`)

console.log("")
if (failed === 0) {
  console.log("✓ Etapa 8 — import legado OK no teste_db\n")
  process.exit(0)
}
console.log(`✗ Etapa 8 — ${failed} falha(s)\n`)
process.exit(1)
