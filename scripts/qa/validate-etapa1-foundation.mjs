/**
 * Checklist Etapa 1 — fundação tenancy completa (teste_db).
 *   node scripts/qa/validate-etapa1-foundation.mjs
 */
import { createClient } from "@supabase/supabase-js"
import { loadCloneEnv, assertTestOnly } from "../import/lib/env-clone.mjs"

const REQUIRED_TABLES = [
  "organizations",
  "units",
  "reservas",
  "usuarios",
  "materials",
  "persons",
  "cautelas",
]

const TABLES_WITH_RESERVA = [
  "usuarios",
  "materials",
  "persons",
  "cautelas",
  "cautela_items",
  "ammo_batches",
]

async function main() {
  const env = loadCloneEnv()
  assertTestOnly(env.SUPABASE_TEST_URL)
  const admin = createClient(env.SUPABASE_TEST_URL, env.SUPABASE_TEST_SERVICE_ROLE_KEY)

  console.log("\n=== Checklist Etapa 1 — fundação (teste_db) ===\n")
  let failed = 0

  for (const table of REQUIRED_TABLES) {
    const { count, error } = await admin.from(table).select("*", { count: "exact", head: true })
    if (error) {
      console.log(`❌ ${table}: ausente ou inacessível (${error.message})`)
      failed++
      continue
    }
    console.log(`✓ ${table}: ${count ?? 0} linhas`)
  }

  for (const table of TABLES_WITH_RESERVA) {
    const { data, error } = await admin.from(table).select("id, reserva_id").limit(5000)
    if (error) {
      console.log(`❌ ${table}.reserva_id: ${error.message}`)
      failed++
      continue
    }
    const missing = (data ?? []).filter((r) => !r.reserva_id)
    if (missing.length > 0) {
      console.log(`❌ ${table}: ${missing.length} linha(s) sem reserva_id`)
      failed++
    } else {
      console.log(`✓ ${table}: todas as linhas com reserva_id`)
    }
  }

  const { error: catErr } = await admin.from("categories").select("id").limit(1)
  if (!catErr) {
    console.log("⚠ categories ainda existe (esperado removida)")
    failed++
  } else {
    console.log("✓ categories removida (legado)")
  }

  if (failed > 0) {
    console.log(`\n❌ Etapa 1 incompleta: ${failed} verificação(ões) falharam`)
    process.exit(1)
  }
  console.log("\n✓ Etapa 1 — fundação tenancy OK no teste_db")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
