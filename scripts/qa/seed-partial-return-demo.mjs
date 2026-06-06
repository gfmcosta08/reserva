/**
 * Cautela QA: pistola + 3 carregadores (nenhum devolvido) para teste parcial PRD §7.3.
 *   node scripts/qa/seed-partial-return-demo.mjs
 *   node scripts/qa/seed-partial-return-demo.mjs --apply
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

function appendQaEnv(key, value) {
  let content = existsSync(QA_ENV_PATH) ? readFileSync(QA_ENV_PATH, "utf8") : ""
  const re = new RegExp(`^${key}=.*$`, "m")
  const line = `${key}=${value}`
  content = re.test(content) ? content.replace(re, line) : `${content.replace(/\s*$/, "")}\n${line}\n`
  writeFileSync(QA_ENV_PATH, content, "utf8")
}

const apply = process.argv.includes("--apply")
const MATRICULA = "064272" // JHONNY

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

  const { data: openCautelas } = await supabase
    .from("cautelas")
    .select("id, status")
    .eq("person_id", person.id)
    .in("status", ["open", "partial"])

  const plan = { person: person.full_name, matricula: MATRICULA, openCautelas: openCautelas?.length || 0 }

  const { data: pistol } = await supabase
    .from("materials")
    .select("id, name, patrimony_number, status")
    .eq("patrimony_number", "PAT-00272")
    .maybeSingle()

  const { data: poolChargers } = await supabase
    .from("materials")
    .select("id, name, patrimony_number, status")
    .like("patrimony_number", `${GLK_POOL_PATRIMONY_PREFIX}%`)
    .eq("status", "available")
    .order("patrimony_number")
    .limit(1)

  const charger = poolChargers?.[0] ?? null

  const { data: ammo } = await supabase
    .from("materials")
    .select("id, name, patrimony_number, status")
    .eq("patrimony_number", "PAT-QA-MUN-001")
    .maybeSingle()

  if (!pistol || !charger || !ammo) {
    console.log("Materiais ausentes:", { pistol: !!pistol, charger: !!charger, ammo: !!ammo })
    console.log("Execute antes: node scripts/qa/seed-pack-accessories.mjs --apply && sync-glock-charger-pool --apply")
    process.exit(1)
  }

  plan.materials = {
    pistol: pistol.patrimony_number,
    charger: charger.patrimony_number,
    ammo: ammo.patrimony_number,
  }

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          ...plan,
          action:
            "dry-run: cautela open + 3 linhas (pistola qty 1, carregadores qty 3, munição qty 50)",
        },
        null,
        2
      )
    )
    return
  }

  if (openCautelas?.length) {
    for (const c of openCautelas) {
      const { data: ci } = await supabase.from("cautela_items").select("material_id").eq("cautela_id", c.id)
      await supabase.from("cautela_items").delete().eq("cautela_id", c.id)
      await supabase.from("cautelas").delete().eq("id", c.id)
      if (ci?.length) {
        await supabase.from("materials").update({ status: "available" }).in("id", ci.map((x) => x.material_id))
      }
    }
  }

  if (pistol.status === "cautelado") {
    await supabase.from("materials").update({ status: "available" }).eq("id", pistol.id)
  }

  const operatorId = await resolveQaOperatorId(supabase)

  const { data: cautela, error: cErr } = await supabase
    .from("cautelas")
    .insert({
      person_id: person.id,
      operator_id: operatorId,
      type: "permanent",
      status: "open",
      notes: "QA seed parcial PRD §7.3",
    })
    .select("id")
    .single()
  if (cErr) throw cErr

  await supabase
    .from("materials")
    .update({ status: "cautelado" })
    .in("id", [pistol.id, charger.id, ammo.id])

  await supabase.from("cautela_items").insert([
    {
      cautela_id: cautela.id,
      material_id: pistol.id,
      quantity_delivered: 1,
      quantity_returned: 0,
      status: "pending",
    },
    {
      cautela_id: cautela.id,
      material_id: charger.id,
      quantity_delivered: 3,
      quantity_returned: 0,
      status: "pending",
    },
    {
      cautela_id: cautela.id,
      material_id: ammo.id,
      quantity_delivered: 50,
      quantity_returned: 0,
      status: "pending",
    },
  ])

  appendQaEnv("E2E_PARTIAL_RETURN_CAUTELA_ID", cautela.id)

  console.log(JSON.stringify({ ok: true, cautela_id: cautela.id, person: person.full_name }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
