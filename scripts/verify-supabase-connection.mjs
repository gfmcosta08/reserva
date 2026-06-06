/**
 * Verifica leitura no Supabase (contagens). Uso:
 *   node scripts/verify-supabase-connection.mjs prod
 *   node scripts/verify-supabase-connection.mjs test
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, existsSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const mode = process.argv[2] || "prod"

let url, key
if (mode === "test") {
  const p = resolve(__dirname, ".env.clone")
  if (!existsSync(p)) {
    console.error("scripts/.env.clone necessário para modo test")
    process.exit(1)
  }
  const env = {}
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const i = t.indexOf("=")
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  url = env.SUPABASE_TEST_URL
  // service_role evita RLS mascarar contagens (BUG-002: anon retornava 0 com dados presentes)
  key = env.SUPABASE_TEST_SERVICE_ROLE_KEY || env.SUPABASE_TEST_ANON_KEY
} else {
  const local = resolve(__dirname, "..", ".env.local")
  if (!existsSync(local)) {
    console.error(".env.local não encontrado")
    process.exit(1)
  }
  const env = {}
  for (const line of readFileSync(local, "utf8").split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const i = t.indexOf("=")
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  url = env.NEXT_PUBLIC_SUPABASE_URL
  key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}

if (!url || !key) {
  console.error("URL/key ausentes")
  process.exit(1)
}

const supabase = createClient(url, key)
const tables = ["materials", "persons", "cautelas", "profiles"]

console.log(`Modo: ${mode} — ${url}`)
for (const table of tables) {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true })
  if (error) console.log(`  ${table}: ERRO ${error.message}`)
  else console.log(`  ${table}: ${count ?? 0} registros`)
}
