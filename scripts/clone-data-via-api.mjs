/**
 * Copia dados prod → teste usando service_role (PostgREST).
 * Ordem respeita FKs. Auth: lista usuários e recria no teste com mesma id quando possível.
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, existsSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, ".env.clone")

function loadEnv() {
  if (!existsSync(envPath)) throw new Error("scripts/.env.clone não encontrado")
  const env = {}
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const i = t.indexOf("=")
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return env
}

const env = loadEnv()
const prod = createClient(env.SUPABASE_PROD_URL, env.SUPABASE_PROD_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const test = createClient(env.SUPABASE_TEST_URL, env.SUPABASE_TEST_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const PAGE = 500

async function fetchAll(client, table) {
  const rows = []
  let from = 0
  while (true) {
    const { data, error } = await client.from(table).select("*").range(from, from + PAGE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data?.length) break
    rows.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return rows
}

async function upsertBatches(client, table, rows, onConflict = "id") {
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100)
    const { error } = await client.from(table).upsert(chunk, { onConflict })
    if (error) throw new Error(`${table} upsert: ${error.message}`)
    process.stdout.write(`\r  ${table}: ${Math.min(i + 100, rows.length)}/${rows.length}`)
  }
  if (rows.length) process.stdout.write("\n")
}

async function clearTestTables() {
  const order = [
    "divergences",
    "cautela_items",
    "cautelas",
    "corrections",
    "audit_logs",
    "ammo_batches",
    "persons",
    "materials",
    "profiles",
  ]
  for (const table of order) {
    const { error } = await test.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000")
    if (error) console.warn(`  limpar ${table}:`, error.message)
  }
}

async function cloneAuthUsers() {
  console.log("auth.users ...")
  const { data: list, error } = await prod.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw error
  const users = list.users ?? []
  console.log(`  ${users.length} usuários em prod`)
  for (const u of users) {
    const { error: delErr } = await test.auth.admin.deleteUser(u.id)
    if (delErr && !delErr.message?.includes("not found")) {
      /* ignore */
    }
    const { error: createErr } = await test.auth.admin.createUser({
      id: u.id,
      email: u.email,
      email_confirm: true,
      phone: u.phone,
      user_metadata: u.user_metadata,
      app_metadata: u.app_metadata,
      password: "ReservaTeste2026!",
    })
    if (createErr) {
      console.warn(`  usuário ${u.email}:`, createErr.message)
    }
  }
  console.log("  senha temporária em teste: ReservaTeste2026! (trocar após validação)")
}

async function main() {
  console.log("Limpando teste...")
  await clearTestTables()

  await cloneAuthUsers()

  const tables = [
    "profiles",
    "materials",
    "persons",
    "cautelas",
    "cautela_items",
    "divergences",
    "audit_logs",
    "corrections",
    "ammo_batches",
  ]

  for (const table of tables) {
    console.log(`${table} ...`)
    try {
      const rows = await fetchAll(prod, table)
      console.log(`  ${rows.length} linhas`)
      if (rows.length) await upsertBatches(test, table, rows)
    } catch (e) {
      console.warn(`  ignorado: ${e.message}`)
    }
  }

  const prodRef = env.SUPABASE_PROD_PROJECT_REF
  const testRef = env.SUPABASE_TEST_PROJECT_REF
  const persons = await fetchAll(test, "persons")
  let updated = 0
  for (const p of persons) {
    const rg_front_url = p.rg_front_url?.replaceAll(prodRef, testRef) ?? p.rg_front_url
    const rg_back_url = p.rg_back_url?.replaceAll(prodRef, testRef) ?? p.rg_back_url
    if (rg_front_url !== p.rg_front_url || rg_back_url !== p.rg_back_url) {
      await test.from("persons").update({ rg_front_url, rg_back_url }).eq("id", p.id)
      updated++
    }
  }
  console.log(`URLs storage atualizadas: ${updated} pessoas`)
  console.log("Concluído.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
