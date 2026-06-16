/**
 * Prepara teste_db para validação humana/CI — opera como produção, dados ficam no teste.
 * Não toca produção. Rode antes de testes manuais ou E2E completos.
 *
 *   node scripts/qa/bootstrap-teste-db.mjs
 *   node scripts/qa/bootstrap-teste-db.mjs --apply
 */
import { spawnSync } from "child_process"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { loadCloneEnv, assertTestOnly } from "../import/lib/env-clone.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "../..")
const apply = process.argv.includes("--apply")
const flag = apply ? "--apply" : ""

const STEPS = [
  ["Pessoa + pistola HT E2E", `scripts/qa/seed-e2e-person.mjs ${flag}`.trim()],
  ["Pacote pistola (3 carregadores + munição)", `scripts/qa/seed-e2e-pistol-pack.mjs ${flag}`.trim()],
  ["Pool Glock 9mm (clone operacional)", `scripts/qa/sync-glock-charger-pool.mjs ${flag}`.trim()],
  ["Material fungível regressão", `scripts/qa/seed-full-regression-fungible.mjs ${flag}`.trim()],
  ["Demos devolução", `scripts/qa/seed-e2e-total-return-demo.mjs ${flag}`.trim()],
  ["Demo devolução parcial", `scripts/qa/seed-partial-return-demo.mjs ${flag}`.trim()],
]

function runStep(label, scriptArgs) {
  console.log(`\n▶ ${label}`)
  const parts = scriptArgs.split(" ")
  const r = spawnSync(process.execPath, parts, { cwd: root, encoding: "utf8" })
  if (r.stdout) process.stdout.write(r.stdout)
  if (r.stderr) process.stderr.write(r.stderr)
  if (r.status !== 0) {
    throw new Error(`Falhou: ${label} (exit ${r.status})`)
  }
}

async function main() {
  const env = loadCloneEnv()
  assertTestOnly(env.SUPABASE_TEST_URL)

  console.log(
    apply
      ? "Bootstrap teste_db (APPLY) — dados QA; produção não é alterada."
      : "Bootstrap teste_db (dry-run) — use --apply para executar."
  )

  for (const [label, args] of STEPS) {
    runStep(label, args)
  }

  console.log("\n✅ Bootstrap teste_db concluído.")
  console.log("Validação manual: https://reserva-teste.vercel.app")
  console.log("Pacote pistola QA: PAT-E2E-GLK-001 + 3 carregadores PAT-E2E-GLK-CHG-* + munição PAT-QA-MUN-001")
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
