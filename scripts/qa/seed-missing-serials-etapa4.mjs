/**
 * Etapa 4 — cadastra 4 seriais faltantes no teste_db (import cautelados).
 *   node scripts/qa/seed-missing-serials-etapa4.mjs
 *   node scripts/qa/seed-missing-serials-etapa4.mjs --apply
 */
import { createClient } from "@supabase/supabase-js"
import { loadCloneEnv, assertTestOnly } from "../import/lib/env-clone.mjs"

const apply = process.argv.includes("--apply")

const MISSING = [
  {
    name: "PISTOLA TAURUS PT 100 (ATAIDES)",
    serial_number: "56703",
    patrimony_number: "PAT-56703",
    internal_code: "TAU-56703",
    category: "PISTOLA",
    marca: "TAURUS",
    modelo: "PT 100",
    calibre: ".40",
    stock_quantity: 1,
  },
  {
    name: "PISTOLA TAURUS PT 100 (VALDSON)",
    serial_number: "3709",
    patrimony_number: "PAT-03709",
    internal_code: "TAU-03709",
    category: "PISTOLA",
    marca: "TAURUS",
    modelo: "PT 100",
    calibre: ".40",
    stock_quantity: 1,
  },
  {
    name: "PISTOLA TAURUS PT 100 (GOUVEIA)",
    serial_number: "27007",
    patrimony_number: "PAT-27007",
    internal_code: "TAU-27007",
    category: "PISTOLA",
    marca: "TAURUS",
    modelo: "PT 100",
    calibre: ".40",
    stock_quantity: 1,
  },
  {
    name: "COLETE BALÍSTICO (MACEDO)",
    serial_number: "9327",
    patrimony_number: "PAT-09327",
    internal_code: "COL-09327",
    category: "COLETE",
    marca: null,
    modelo: "PEQUENO/M",
    calibre: null,
    stock_quantity: 1,
  },
]

async function main() {
  const env = loadCloneEnv()
  assertTestOnly(env.SUPABASE_TEST_URL)
  const supabase = createClient(env.SUPABASE_TEST_URL, env.SUPABASE_TEST_SERVICE_ROLE_KEY)

  const plan = { insert: [], exists: [], errors: [] }

  for (const row of MISSING) {
    const { data: bySerial } = await supabase
      .from("materials")
      .select("id, patrimony_number, serial_number, status")
      .eq("serial_number", row.serial_number)
      .maybeSingle()

    const { data: byPat } = await supabase
      .from("materials")
      .select("id, patrimony_number, serial_number, status")
      .eq("patrimony_number", row.patrimony_number)
      .maybeSingle()

    const existing = bySerial ?? byPat
    if (existing) {
      plan.exists.push({
        serial: row.serial_number,
        id: existing.id,
        patrimony: existing.patrimony_number,
        status: existing.status,
      })
      continue
    }

    if (apply) {
      const { data, error } = await supabase
        .from("materials")
        .insert({ ...row, status: "available" })
        .select("id, patrimony_number, serial_number")
        .single()
      if (error) plan.errors.push({ serial: row.serial_number, error: error.message })
      else plan.insert.push(data)
    } else {
      plan.insert.push({ would_insert: row.patrimony_number, serial: row.serial_number })
    }
  }

  console.log(JSON.stringify({ ok: plan.errors.length === 0, mode: apply ? "apply" : "dry-run", ...plan }, null, 2))
  if (plan.errors.length) process.exit(1)
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
