/**
 * Garante carregador e munição 9mm DISPONÍVEIS no teste_db para pacote pistola (Nova Cautela).
 *   node scripts/qa/seed-pack-accessories.mjs
 *   node scripts/qa/seed-pack-accessories.mjs --apply
 */
import { createClient } from "@supabase/supabase-js"
import { loadCloneEnv, assertTestOnly } from "../import/lib/env-clone.mjs"

const apply = process.argv.includes("--apply")

const ACCESSORIES = [
  {
    name: "CARREGADOR GLOCK 9MM (QA DISPONÍVEL)",
    category: "CARREGADOR",
    patrimony_number: "PAT-QA-CAR-002",
    internal_code: "QA-CAR-002",
    serial_number: "QA-CHG-002",
    calibre: "9mm",
    status: "available",
  },
  {
    name: "MUNICAO 9MM (QA DISPONÍVEL)",
    category: "MUNICAO",
    patrimony_number: "PAT-QA-MUN-001",
    internal_code: "QA-MUN-001",
    serial_number: null,
    calibre: "9mm",
    status: "available",
  },
]

async function main() {
  const env = loadCloneEnv()
  assertTestOnly(env.SUPABASE_TEST_URL)
  const supabase = createClient(env.SUPABASE_TEST_URL, env.SUPABASE_TEST_SERVICE_ROLE_KEY)

  const plan = []
  for (const row of ACCESSORIES) {
    const { data: existing } = await supabase
      .from("materials")
      .select("id, status, name")
      .eq("patrimony_number", row.patrimony_number)
      .maybeSingle()

    if (existing) {
      if (existing.status !== "available" && apply) {
        await supabase.from("materials").update({ status: "available" }).eq("id", existing.id)
        plan.push({ patrimony: row.patrimony_number, action: "set available" })
      } else {
        plan.push({ patrimony: row.patrimony_number, action: "already exists", status: existing.status })
      }
      continue
    }

    plan.push({ patrimony: row.patrimony_number, action: apply ? "insert" : "would insert" })
    if (apply) {
      const { error } = await supabase.from("materials").insert(row)
      if (error) throw new Error(`${row.patrimony_number}: ${error.message}`)
    }
  }

  console.log(JSON.stringify({ apply, plan }, null, 2))
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
