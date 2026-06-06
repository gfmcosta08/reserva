/**
 * Seed E2E-06: 1 carregador pool cautelado → devolução total → Disponível em /materials.
 *   node scripts/qa/seed-stock-partial-return.mjs --apply
 */
import { readFileSync, writeFileSync, existsSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { createClient } from "@supabase/supabase-js"
import { loadCloneEnv, assertTestOnly } from "../import/lib/env-clone.mjs"
import { resolveQaOperatorId } from "./lib/qa-operator.mjs"
import { GLK_POOL_PATRIMONY_PREFIX } from "../import/lib/glock-9mm-inventory.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const QA_ENV_PATH = resolve(__dirname, "../.env.qa")
const apply = process.argv.includes("--apply")
const MATRICULA = "064272"

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
  if (!person) throw new Error(`Pessoa mat ${MATRICULA} não encontrada`)

  const { data: charger } = await supabase
    .from("materials")
    .select("id, patrimony_number, status, stock_quantity")
    .like("patrimony_number", `${GLK_POOL_PATRIMONY_PREFIX}%`)
    .eq("status", "available")
    .order("patrimony_number")
    .limit(1)
    .maybeSingle()

  if (!charger) {
    console.error("Nenhum carregador pool available. Rode sync-glock-charger-pool --apply")
    process.exit(1)
  }

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          dry_run: true,
          charger: charger.patrimony_number,
          action: "cautela open: 1 carregador qty 1",
        },
        null,
        2
      )
    )
    return
  }

  const { data: openCautelas } = await supabase
    .from("cautelas")
    .select("id")
    .eq("person_id", person.id)
    .in("status", ["open", "partial"])

  for (const c of openCautelas ?? []) {
    const { data: ci } = await supabase.from("cautela_items").select("material_id").eq("cautela_id", c.id)
    await supabase.from("cautela_items").delete().eq("cautela_id", c.id)
    await supabase.from("cautelas").delete().eq("id", c.id)
    for (const item of ci ?? []) {
      await supabase
        .from("materials")
        .update({ status: "available", stock_quantity: 1 })
        .eq("id", item.material_id)
    }
  }

  await supabase
    .from("materials")
    .update({ status: "available", stock_quantity: 1 })
    .eq("id", charger.id)

  const operatorId = await resolveQaOperatorId(supabase)

  const { data: cautela, error: cErr } = await supabase
    .from("cautelas")
    .insert({
      person_id: person.id,
      operator_id: operatorId,
      type: "permanent",
      status: "open",
      notes: "QA seed E2E-06 stock restore",
    })
    .select("id")
    .single()
  if (cErr) throw cErr

  await supabase
    .from("materials")
    .update({ status: "cautelado", stock_quantity: 0 })
    .eq("id", charger.id)

  await supabase.from("cautela_items").insert({
    cautela_id: cautela.id,
    material_id: charger.id,
    quantity_delivered: 1,
    quantity_returned: 0,
    status: "pending",
  })

  appendQaEnv("E2E_STOCK_PARTIAL_CAUTELA_ID", cautela.id)
  appendQaEnv("E2E_STOCK_CHARGER_PATRIMONY", charger.patrimony_number)

  console.log(
    JSON.stringify(
      {
        ok: true,
        cautela_id: cautela.id,
        charger_patrimony: charger.patrimony_number,
        charger_id: charger.id,
      },
      null,
      2
    )
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
