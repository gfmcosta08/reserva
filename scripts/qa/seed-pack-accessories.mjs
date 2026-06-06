/**
 * @deprecated Use sync-glock-charger-pool.mjs — mantém munição QA e delega carregadores ao sync.
 *
 *   node scripts/qa/seed-pack-accessories.mjs --apply
 */
import { spawnSync } from "child_process"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { createClient } from "@supabase/supabase-js"
import { loadCloneEnv, assertTestOnly } from "../import/lib/env-clone.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const apply = process.argv.includes("--apply")

const SYNC = resolve(__dirname, "sync-glock-charger-pool.mjs")

async function ensureAmmo(supabase) {
  const row = {
    name: "MUNICAO 9MM (QA DISPONÍVEL)",
    category: "MUNICAO",
    patrimony_number: "PAT-QA-MUN-001",
    internal_code: "QA-MUN-001",
    serial_number: null,
    calibre: "9mm",
    status: "available",
  }
  const { data: existing } = await supabase
    .from("materials")
    .select("id, status")
    .eq("patrimony_number", row.patrimony_number)
    .maybeSingle()

  if (existing) {
    if (existing.status !== "available" && apply) {
      await supabase.from("materials").update({ status: "available" }).eq("id", existing.id)
      return { action: "ammo set available" }
    }
    return { action: "ammo exists", status: existing.status }
  }
  if (apply) {
    const { error } = await supabase.from("materials").insert(row)
    if (error) throw new Error(error.message)
  }
  return { action: apply ? "ammo insert" : "ammo would insert" }
}

async function main() {
  const env = loadCloneEnv()
  assertTestOnly(env.SUPABASE_TEST_URL)
  const supabase = createClient(env.SUPABASE_TEST_URL, env.SUPABASE_TEST_SERVICE_ROLE_KEY)

  const ammo = await ensureAmmo(supabase)

  const syncArgs = ["scripts/qa/sync-glock-charger-pool.mjs"]
  if (apply) syncArgs.push("--apply")

  const r = spawnSync(process.execPath, syncArgs, {
    cwd: resolve(__dirname, "../.."),
    encoding: "utf8",
  })

  console.log(JSON.stringify({ apply, ammo, sync_exit: r.status }, null, 2))
  if (r.stdout) process.stdout.write(r.stdout)
  if (r.stderr) process.stderr.write(r.stderr)
  if (r.status !== 0) process.exit(r.status ?? 1)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
