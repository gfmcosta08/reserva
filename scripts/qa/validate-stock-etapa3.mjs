/**
 * Gate Etapa 3 — valida stock_quantity, constraint e RPC no teste_db.
 *   node scripts/qa/validate-stock-etapa3.mjs
 */
import { createClient } from "@supabase/supabase-js"
import { loadCloneEnv, assertTestOnly } from "../import/lib/env-clone.mjs"
import { GLK_POOL_PATRIMONY_PREFIX } from "../import/lib/glock-9mm-inventory.mjs"

async function fetchAll(client, table, select) {
  const rows = []
  let from = 0
  const PAGE = 1000
  while (true) {
    const { data, error } = await client.from(table).select(select).range(from, from + PAGE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data?.length) break
    rows.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return rows
}

async function main() {
  const env = loadCloneEnv()
  assertTestOnly(env.SUPABASE_TEST_URL)
  const supabase = createClient(env.SUPABASE_TEST_URL, env.SUPABASE_TEST_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const materials = await fetchAll(
    supabase,
    "materials",
    "id, name, patrimony_number, status, stock_quantity, category"
  )

  const negative = materials.filter((m) => (m.stock_quantity ?? 1) < 0)
  const fungible = materials.filter((m) => (m.stock_quantity ?? 1) > 1)
  const poolAvailable = materials.filter(
    (m) =>
      String(m.patrimony_number ?? "").startsWith(GLK_POOL_PATRIMONY_PREFIX) &&
      m.status === "available"
  )
  const unitWeapons = materials.filter(
    (m) =>
      (m.stock_quantity ?? 1) === 1 &&
      /pistola|arma|glock/i.test(`${m.name} ${m.category}`)
  )

  const { data: rpcProbe, error: rpcErr } = await supabase.rpc("create_cautela_atomic", {
    p_person_id: "00000000-0000-0000-0000-000000000000",
    p_type: "daily",
    p_notes: "probe",
    p_items: [],
  })

  const rpcExists =
    rpcErr &&
    (rpcErr.message.includes("EMPTY_MATERIALS") ||
      rpcErr.message.includes("NOT_AUTHENTICATED") ||
      rpcErr.code === "P0001")

  const checks = {
    materials_total: materials.length,
    stock_column_ok: materials.every((m) => m.stock_quantity != null),
    negative_stock_count: negative.length,
    fungible_count: fungible.length,
    pool_available_count: poolAvailable.length,
    unit_weapons_sample: unitWeapons.length,
    rpc_create_cautela_atomic: Boolean(rpcExists),
  }

  const failures = []
  if (!checks.stock_column_ok) failures.push("Coluna stock_quantity ausente em algum material")
  if (checks.negative_stock_count > 0) failures.push(`${negative.length} material(is) com stock negativo`)
  if (!checks.rpc_create_cautela_atomic) {
    failures.push(`RPC create_cautela_atomic: ${rpcErr?.message ?? "sem resposta"}`)
  }

  const result = {
    ok: failures.length === 0,
    checks,
    failures,
    samples: {
      negative: negative.slice(0, 5),
      fungible: fungible.slice(0, 5).map((m) => ({
        patrimony: m.patrimony_number,
        stock: m.stock_quantity,
        status: m.status,
      })),
      pool_available: poolAvailable.slice(0, 5).map((m) => m.patrimony_number),
    },
    rpc_probe: rpcErr?.message ?? String(rpcProbe),
  }

  console.log(JSON.stringify(result, null, 2))
  if (!result.ok) process.exit(1)
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
