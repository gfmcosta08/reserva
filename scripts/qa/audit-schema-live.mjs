/**
 * Coleta metadados do schema live (teste_db) para AUDITORIA.md
 *   node scripts/qa/audit-schema-live.mjs
 */
import { createClient } from "@supabase/supabase-js"
import { writeFileSync, mkdirSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { loadCloneEnv, assertTestOnly } from "../import/lib/env-clone.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))

const TABLES = [
  "profiles",
  "persons",
  "materials",
  "cautelas",
  "cautela_items",
  "divergences",
  "audit_logs",
  "corrections",
  "ammo_batches",
  "organizations",
  "units",
  "usuarios",
  "categories",
]

async function main() {
  const env = loadCloneEnv()
  assertTestOnly(env.SUPABASE_TEST_URL)
  const supabase = createClient(env.SUPABASE_TEST_URL, env.SUPABASE_TEST_SERVICE_ROLE_KEY)

  const snapshot = { generated_at: new Date().toISOString(), database: "teste_db", tables: {} }

  for (const table of TABLES) {
    const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true })
    if (error) {
      snapshot.tables[table] = { exists: false, error: error.message }
      continue
    }
    const { data: sample } = await supabase.from(table).select("*").limit(1)
    const columns = sample?.[0] ? Object.keys(sample[0]).sort() : []
    snapshot.tables[table] = { exists: true, row_count: count ?? 0, columns }
  }

  const outDir = resolve(__dirname, "../../docs")
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, "audit-schema-live.json")
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2), "utf8")
  console.log(`OK — ${outPath}`)
  for (const [t, info] of Object.entries(snapshot.tables)) {
    if (!info.exists) console.log(`  ${t}: (ausente) ${info.error}`)
    else console.log(`  ${t}: ${info.row_count} linhas, ${info.columns.length} colunas`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
