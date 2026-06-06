/**
 * Pessoa E2E (mat. 999888, PIN 5678) + material HT dedicado no teste_db.
 *   node scripts/qa/seed-e2e-person.mjs
 *   node scripts/qa/seed-e2e-person.mjs --apply
 */
import { readFileSync, writeFileSync, existsSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import bcrypt from "bcryptjs"
import { createClient } from "@supabase/supabase-js"
import { loadCloneEnv, assertTestOnly, placeholderEmail, TEST_REF } from "../import/lib/env-clone.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const QA_ENV_PATH = resolve(__dirname, "../.env.qa")
const apply = process.argv.includes("--apply")

const MATRICULA = "999888"
const PIN = "5678"
const FULL_NAME = "TESTE QA E2E"
const RG = "RG999888"

const E2E_HT = {
  name: "HT QA E2E",
  category: "RADIO HT",
  patrimony_number: "PAT-E2E-HT-001",
  internal_code: "E2E-HT-001",
  serial_number: "SN-E2E-001",
  status: "available",
}

function appendQaEnvVars(vars) {
  let content = existsSync(QA_ENV_PATH) ? readFileSync(QA_ENV_PATH, "utf8") : ""
  for (const [key, value] of Object.entries(vars)) {
    const re = new RegExp(`^${key}=.*$`, "m")
    const line = `${key}=${value}`
    content = re.test(content) ? content.replace(re, line) : `${content.replace(/\s*$/, "")}\n${line}\n`
  }
  writeFileSync(QA_ENV_PATH, content, "utf8")
}

async function main() {
  const env = loadCloneEnv()
  assertTestOnly(env.SUPABASE_TEST_URL)
  const supabase = createClient(env.SUPABASE_TEST_URL, env.SUPABASE_TEST_SERVICE_ROLE_KEY)
  const pinHash = await bcrypt.hash(PIN, 10)

  const plan = { matricula: MATRICULA, pin: PIN, material: E2E_HT.patrimony_number, apply }

  const { data: existing } = await supabase
    .from("persons")
    .select("id, full_name")
    .eq("registration_number", MATRICULA)
    .maybeSingle()

  if (existing) {
    plan.person = { action: "update", id: existing.id, full_name: existing.full_name }
    if (apply) {
      const { error } = await supabase
        .from("persons")
        .update({
          full_name: FULL_NAME,
          rg: RG,
          email: placeholderEmail(MATRICULA),
          pin_hash: pinHash,
          status: "active",
        })
        .eq("id", existing.id)
      if (error) throw error
    }
  } else {
    plan.person = { action: "insert" }
    if (apply) {
      const { data, error } = await supabase
        .from("persons")
        .insert({
          full_name: FULL_NAME,
          rg: RG,
          registration_number: MATRICULA,
          email: placeholderEmail(MATRICULA),
          pin_hash: pinHash,
          status: "active",
        })
        .select("id")
        .single()
      if (error) throw error
      plan.person.id = data.id
    }
  }

  const { data: mat } = await supabase
    .from("materials")
    .select("id, status")
    .eq("patrimony_number", E2E_HT.patrimony_number)
    .maybeSingle()

  if (mat) {
    plan.material_action = "exists"
    if (apply && mat.status !== "available") {
      await supabase.from("materials").update({ status: "available" }).eq("id", mat.id)
      plan.material_action = "set available"
    }
  } else {
    plan.material_action = apply ? "insert" : "would insert"
    if (apply) {
      const { error } = await supabase.from("materials").insert(E2E_HT)
      if (error) throw error
    }
  }

  if (apply) {
    appendQaEnvVars({
      E2E_PERSON_MATRICULA: MATRICULA,
      E2E_PERSON_PIN: PIN,
      E2E_PERSON_NAME: FULL_NAME,
      E2E_HT_PATRIMONY: E2E_HT.patrimony_number,
      QA_SUPABASE_REF: TEST_REF,
    })
    plan.env_qa = "updated"
  }

  console.log(JSON.stringify({ ok: true, ...plan }, null, 2))
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
