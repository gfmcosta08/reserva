/**
 * Cautela open com 1 HT E2E para teste de devolução total (E2E-03).
 * Requer: seed-e2e-person.mjs --apply
 *   node scripts/qa/seed-e2e-total-return-demo.mjs --apply
 */
import { readFileSync, writeFileSync, existsSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { createClient } from "@supabase/supabase-js"
import { loadCloneEnv, assertTestOnly } from "../import/lib/env-clone.mjs"
import { resolveQaOperatorId } from "./lib/qa-operator.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const QA_ENV_PATH = resolve(__dirname, "../.env.qa")
const apply = process.argv.includes("--apply")
const MATRICULA = "999888"
const HT_PAT = "PAT-E2E-HT-001"
const NOTES = "E2E-03 total return demo"

function appendQaEnv(key, value) {
  let content = existsSync(QA_ENV_PATH) ? readFileSync(QA_ENV_PATH, "utf8") : ""
  const re = new RegExp(`^${key}=.*$`, "m")
  const line = `${key}=${value}`
  content = re.test(content) ? content.replace(re, line) : `${content.replace(/\s*$/, "")}\n${line}\n`
  writeFileSync(QA_ENV_PATH, content, "utf8")
}
async function main() {
  const env = loadCloneEnv()
  assertTestOnly(env.SUPABASE_TEST_URL)
  const supabase = createClient(env.SUPABASE_TEST_URL, env.SUPABASE_TEST_SERVICE_ROLE_KEY)

  const { data: person } = await supabase
    .from("persons")
    .select("id, full_name")
    .eq("registration_number", MATRICULA)
    .maybeSingle()
  if (!person) throw new Error(`Pessoa mat ${MATRICULA} não encontrada — rode seed-e2e-person.mjs --apply`)

  const { data: material } = await supabase
    .from("materials")
    .select("id, name, status")
    .eq("patrimony_number", HT_PAT)
    .maybeSingle()
  if (!material) throw new Error(`Material ${HT_PAT} não encontrado — rode seed-e2e-person.mjs --apply`)

  const { data: existing } = await supabase
    .from("cautelas")
    .select("id, status")
    .eq("person_id", person.id)
    .eq("notes", NOTES)
    .in("status", ["open", "partial"])
    .maybeSingle()

  const plan = {
    person: person.full_name,
    material: HT_PAT,
    existing_cautela: existing?.id ?? null,
    apply,
  }

  if (!apply) {
    console.log(JSON.stringify(plan, null, 2))
    return
  }

  if (existing) {
    await supabase.from("cautela_items").delete().eq("cautela_id", existing.id)
    await supabase.from("cautelas").delete().eq("id", existing.id)
  }

  const operatorId = await resolveQaOperatorId(supabase)

  const { data: cautela, error: cErr } = await supabase
    .from("cautelas")
    .insert({
      person_id: person.id,
      operator_id: operatorId,
      type: "daily",
      status: "open",
      notes: NOTES,
    })
    .select("id")
    .single()
  if (cErr) throw cErr

  await supabase.from("materials").update({ status: "cautelado" }).eq("id", material.id)
  await supabase.from("cautela_items").insert({
    cautela_id: cautela.id,
    material_id: material.id,
    quantity_delivered: 1,
    quantity_returned: 0,
    status: "pending",
  })

  appendQaEnv("E2E_TOTAL_RETURN_CAUTELA_ID", cautela.id)

  console.log(JSON.stringify({ ok: true, cautela_id: cautela.id, ...plan }, null, 2))
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
