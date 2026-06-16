/**
 * Regressão completa no teste_db — gate principal: Playwright (Chromium) × N rodadas.
 *
 * Os testes E2E simulam uso real: login, cliques, digitação, navegação e modais
 * via Playwright + Chromium (headless em CI; mesmo motor do Chrome Desktop).
 *
 * Uso:
 *   node scripts/qa/run-full-regression-3x.mjs
 *   node scripts/qa/run-full-regression-3x.mjs --runs=3
 *   node scripts/qa/run-full-regression-3x.mjs --runs=3 --browser-only
 *
 * npm:
 *   npm run test:regression:3x          — Vitest + validate-stock + Playwright ×3
 *   npm run test:regression:browser:3x — somente Playwright ×3 (gate de browser)
 */
import { execSync, spawnSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "../..")
const runsArg = process.argv.find((a) => a.startsWith("--runs="))
const runs = runsArg ? Math.max(1, parseInt(runsArg.split("=")[1], 10) || 3) : 3
const browserOnly = process.argv.includes("--browser-only")
const baseUrl = process.env.E2E_BASE_URL || "https://reserva-teste.vercel.app"

const E2E_SPECS = [
  { file: "e2e-01-login.spec.ts", covers: "Login supervisor e navegação para Cautelas" },
  { file: "e2e-02-nova-cautela.spec.ts", covers: "Nova cautela diária (mat. 999888 + PIN)" },
  { file: "e2e-03-devolucao-total.spec.ts", covers: "Devolução total de item da cautela demo" },
  { file: "e2e-04-devolucao-parcial.spec.ts", covers: "Devolução parcial mantém status Parcial" },
  { file: "e2e-05-divergencias.spec.ts", covers: "Página /reports/divergencias" },
  { file: "e2e-06-stock.spec.ts", covers: "Devolução restaura Disponível em /materials" },
  { file: "e2e-07-etapa5-smoke.spec.ts", covers: "Logout, relatórios, alerts, ammo-batches, deep links, exports autenticados" },
  { file: "e2e-08-full-coverage.spec.ts", covers: "Dashboard, CRUD material, estoque fungível, cautela permanente, pessoa, /api/version, exports 401" },
  { file: "e2e-lists.spec.ts", covers: "Listagens /materials e /persons" },
]

const MANUAL_ONLY = [
  "OCR de documentos / reconhecimento facial",
  "Layout e gestos em dispositivos móveis",
  "Bloqueio por tentativas de PIN incorretas",
  "Impressão física de comprovantes",
  "Performance sob carga concorrente",
  "Integração e-mail (Resend) em produção",
]

function loadQaEnv() {
  const p = resolve(root, "scripts/.env.qa")
  if (!existsSync(p)) return
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq <= 0) continue
    const k = t.slice(0, eq).trim()
    const v = t.slice(eq + 1).trim()
    if (!process.env[k]) process.env[k] = v
  }
  if (!process.env.E2E_SUPERVISOR_EMAIL && process.env.QA_SUPERVISOR_EMAIL) {
    process.env.E2E_SUPERVISOR_EMAIL = process.env.QA_SUPERVISOR_EMAIL
  }
  if (!process.env.E2E_SUPERVISOR_PASSWORD && process.env.QA_SUPERVISOR_PASSWORD) {
    process.env.E2E_SUPERVISOR_PASSWORD = process.env.QA_SUPERVISOR_PASSWORD
  }
}

function run(cmd, label) {
  const started = Date.now()
  const r = spawnSync(cmd, {
    cwd: root,
    shell: true,
    encoding: "utf8",
    env: { ...process.env, CI: "1", E2E_BASE_URL: baseUrl },
    stdio: ["ignore", "pipe", "pipe"],
  })
  const ms = Date.now() - started
  return {
    label,
    cmd,
    ok: r.status === 0,
    exitCode: r.status ?? 1,
    ms,
    stdout: (r.stdout || "").trim(),
    stderr: (r.stderr || "").trim(),
  }
}

function parsePlaywrightSummary(text) {
  const passed = text.match(/(\d+)\s+passed/)?.[1]
  const failed = text.match(/(\d+)\s+failed/)?.[1]
  const skipped = text.match(/(\d+)\s+skipped/)?.[1]
  return {
    passed: passed ? Number(passed) : null,
    failed: failed ? Number(failed) : 0,
    skipped: skipped ? Number(skipped) : 0,
  }
}

function fetchVersion() {
  try {
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
    const headers = bypass
      ? `-H "x-vercel-protection-bypass: ${bypass}" -H "x-vercel-set-bypass-cookie: true"`
      : ""
    const curl = process.platform === "win32" ? "curl.exe" : "curl"
    const out = execSync(`${curl} -s ${headers} "${baseUrl}/api/version"`, {
      encoding: "utf8",
      shell: true,
    })
    return JSON.parse(out)
  } catch {
    return null
  }
}

function formatDate(iso) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
}

function writeMarkdownReport(report) {
  const { version, results, allOk, runs: runCount, startedAt, finishedAt, baseUrl: url } = report
  const vitest = results.find((r) => r.label === "vitest")
  const stock = results.find((r) => r.label === "validate-stock-etapa3")
  const e2eRuns = results.filter((r) => r.label.startsWith("e2e-run-"))

  const specTable = E2E_SPECS.map(
    (s) => `| \`${s.file}\` | ${s.covers} |`
  ).join("\n")

  const roundTable = e2eRuns
    .map((r) => {
      const s = r.summary ?? {}
      const status = r.ok ? "✅ OK" : "❌ FALHOU"
      return `| ${r.round} | ${s.passed ?? "?"} | ${s.failed ?? 0} | ${s.skipped ?? 0} | ${status} | ${Math.round(r.ms / 1000)}s |`
    })
    .join("\n")

  const manualList = MANUAL_ONLY.map((m) => `- ${m}`).join("\n")

  const commit = version?.vercelGitCommitSha?.slice(0, 7) ?? "desconhecido"
  const env = version?.supabaseEnv ?? "?"
  const ref = version?.supabaseRef ?? "?"

  const md = `# Relatório de Regressão Completa — RESERVA

**Data:** ${formatDate(startedAt)} — ${formatDate(finishedAt)}  
**Ambiente:** ${url}  
**Supabase:** \`${env}\` (ref \`${ref}\`)  
**Commit (Vercel):** \`${commit}\`  
**Motor de testes:** Playwright + Chromium Desktop Chrome (headless em CI)

---

## Gate principal: testes de browser (Playwright)

A regressão funcional **obrigatoriamente** passa pelo Playwright com Chromium.
Cada teste abre páginas reais, faz login, clica em botões, preenche formulários
e valida o DOM — simulando uso humano do sistema. \`headed: false\` em CI usa
o mesmo motor do Chrome, apenas sem janela visível.

Comandos:

\`\`\`powershell
$env:CI="1"
$env:E2E_BASE_URL="https://reserva-teste.vercel.app"
npx playwright test
\`\`\`

\`\`\`bash
npm run test:regression:browser:3x   # somente Playwright ×3
npm run test:regression:3x           # Vitest + validate-stock + Playwright ×3
\`\`\`

---

## Specs E2E (browser)

| Arquivo | Cobertura |
|---------|-----------|
${specTable}

---

## Resultados por rodada (Playwright)

| Rodada | Passed | Failed | Skipped | Status | Duração |
|--------|--------|--------|---------|--------|---------|
${roundTable}

---

## Vitest (unitário)

| Status | Duração |
|--------|---------|
| ${vitest?.ok ? "✅ OK" : browserOnly ? "— (não executado)" : "❌ FALHOU"} | ${vitest ? `${Math.round(vitest.ms / 1000)}s` : "—"} |

## Gate stock_quantity (validate-stock-etapa3)

| Status | Duração |
|--------|---------|
| ${stock?.ok ? "✅ OK" : browserOnly ? "— (não executado)" : "❌ FALHOU"} | ${stock ? `${Math.round(stock.ms / 1000)}s` : "—"} |

---

## Itens manuais (fora da suíte browser)

${manualList}

---

## Recomendação de gate — Etapa 7

**${allOk ? "APROVADO" : "REPROVADO"}**

${allOk
    ? `Todas as ${runCount} rodadas Playwright passaram, com Vitest e validate-stock OK.`
    : "Uma ou mais etapas falharam — ver detalhes acima e logs do Playwright."}

---

*Gerado automaticamente por \`scripts/qa/run-full-regression-3x.mjs\`*
`

  const mdPath = resolve(root, "docs/QA-FULL-REGRESSION-REPORT.md")
  writeFileSync(mdPath, md, "utf8")
  return mdPath
}

async function main() {
  loadQaEnv()
  const startedAt = new Date().toISOString()
  const version = fetchVersion()
  const results = []

  console.log(`\n=== Regressão completa — gate Playwright (Chromium) × ${runs} rodada(s) ===`)
  console.log(`Base URL: ${baseUrl}`)
  console.log(`Modo: ${browserOnly ? "somente browser" : "completo (Vitest + stock + browser)"}`)
  if (version) {
    console.log(
      `Ambiente: ${version.supabaseEnv} (${version.supabaseRef}) commit ${version.vercelGitCommitSha?.slice(0, 7) ?? "?"}`
    )
  }

  if (!browserOnly) {
    const vitest = run("npm test", "vitest")
    results.push(vitest)
    console.log(vitest.ok ? "✅ Vitest OK" : "❌ Vitest FALHOU")

    const stockGate = run("node scripts/qa/validate-stock-etapa3.mjs", "validate-stock-etapa3")
    results.push(stockGate)
    console.log(stockGate.ok ? "✅ Gate stock_quantity OK" : "❌ Gate stock_quantity FALHOU")
  }

  for (let i = 1; i <= runs; i++) {
    const e2e = run("npx playwright test", `e2e-run-${i}`)
    const summary = parsePlaywrightSummary(`${e2e.stdout}\n${e2e.stderr}`)
    results.push({ ...e2e, round: i, summary })
    const icon = e2e.ok ? "✅" : "❌"
    console.log(
      `${icon} E2E browser rodada ${i}/${runs} — ${summary.passed ?? "?"} passed, ${summary.failed} failed, ${summary.skipped} skipped (${Math.round(e2e.ms / 1000)}s)`
    )
  }

  const allOk = results.every((r) => r.ok)
  const report = {
    startedAt,
    finishedAt: new Date().toISOString(),
    baseUrl,
    version,
    runs,
    browserOnly,
    gate: "playwright-chromium",
    allOk,
    e2eSpecs: E2E_SPECS,
    manualOnly: MANUAL_ONLY,
    results: results.map((r) => ({
      label: r.label,
      round: r.round ?? null,
      ok: r.ok,
      exitCode: r.exitCode,
      ms: r.ms,
      summary: r.summary ?? null,
    })),
  }

  const outDir = resolve(root, "docs")
  mkdirSync(outDir, { recursive: true })
  const jsonPath = resolve(outDir, "QA-FULL-REGRESSION-LAST.json")
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8")

  const mdPath = writeMarkdownReport(report)

  console.log(`\nResultado final: ${allOk ? "APROVADO" : "REPROVADO"}`)
  console.log(`Relatório JSON: ${jsonPath}`)
  console.log(`Relatório MD:   ${mdPath}`)
  process.exit(allOk ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
