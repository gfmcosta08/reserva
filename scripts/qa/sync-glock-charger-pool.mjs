/**
 * Sincroniza pool de carregadores Glock 9mm no teste_db APENAS para alinhar dados de QA.
 *
 * Regra de SEED (não é regra de negócio em produção nem na Nova Cautela):
 *   total de carregadores no pool = 3 × N pistolas Glock 9mm cadastradas
 *
 * A Nova Cautela permite qualquer quantidade de carregadores, limitada só pelo
 * saldo disponível no pool (status available).
 *
 *   node scripts/qa/sync-glock-charger-pool.mjs
 *   node scripts/qa/sync-glock-charger-pool.mjs --apply
 */
import { writeFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { createClient } from "@supabase/supabase-js"
import { loadCloneEnv, assertTestOnly } from "../import/lib/env-clone.mjs"
import {
  GLK_POOL_PATRIMONY_PREFIX,
  countPoolChargersByStatus,
  isChargerMaterial,
  isGlock9mmCharger,
  isGlock9mmPistol,
  targetChargerCount,
} from "../import/lib/glock-9mm-inventory.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPORT = resolve(__dirname, "sync-glock-charger-pool-report.md")
const apply = process.argv.includes("--apply")

async function fetchAll(client, table, select = "*") {
  const rows = []
  let from = 0
  const PAGE = 500
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

function nextPoolPatrimony(existingPool) {
  let max = 0
  for (const m of existingPool) {
    const pat = String(m.patrimony_number ?? "")
    const m2 = pat.match(/^PAT-GLK-POOL-(\d+)$/i)
    if (m2) max = Math.max(max, parseInt(m2[1], 10))
  }
  return (n) => {
    const num = max + n
    const pad = String(num).padStart(4, "0")
    return {
      patrimony_number: `${GLK_POOL_PATRIMONY_PREFIX}${pad}`,
      internal_code: `GLK-POOL-${pad}`,
      serial_number: `GLK-CHG-${pad}`,
      name: `CARREGADOR GLOCK 9MM (POOL ${pad})`,
    }
  }
}

async function findOpenCautelasMissingChargers(supabase, materials, openCautelas, items) {
  const matById = new Map(materials.map((m) => [m.id, m]))
  const openIds = new Set(openCautelas.map((c) => c.id))
  const itemsByCautela = new Map()
  for (const i of items) {
    if (!openIds.has(i.cautela_id)) continue
    if (!itemsByCautela.has(i.cautela_id)) itemsByCautela.set(i.cautela_id, [])
    itemsByCautela.get(i.cautela_id).push(i)
  }

  const flags = []
  for (const c of openCautelas) {
    if (c.status !== "open" && c.status !== "partial") continue
    const lines = itemsByCautela.get(c.id) ?? []
    const hasGlock = lines.some((i) => {
      const m = matById.get(i.material_id)
      return m && isGlock9mmPistol(m)
    })
    if (!hasGlock) continue

    let chargerLines = 0
    let chargerUnits = 0
    for (const i of lines) {
      const m = matById.get(i.material_id)
      if (!m || !isChargerMaterial(m)) continue
      if (i.status === "pending" || i.status === "returned") {
        chargerLines++
        chargerUnits += Math.max(0, (i.quantity_delivered || 1) - (i.quantity_returned || 0))
      }
    }
    if (chargerLines < 1) {
      flags.push({
        cautela_id: c.id,
        status: c.status,
        charger_lines: chargerLines,
        charger_units_pending: chargerUnits,
        note: "Cautela com Glock sem linha de carregador (legado import)",
      })
    }
  }
  return flags
}

async function main() {
  const env = loadCloneEnv()
  assertTestOnly(env.SUPABASE_TEST_URL)
  const supabase = createClient(env.SUPABASE_TEST_URL, env.SUPABASE_TEST_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const [materials, openCautelas, items] = await Promise.all([
    fetchAll(
      supabase,
      "materials",
      "id, name, category, calibre, marca, patrimony_number, internal_code, serial_number, status"
    ),
    fetchAll(supabase, "cautelas", "id, status").then((rows) =>
      rows.filter((c) => c.status === "open" || c.status === "partial")
    ),
    fetchAll(
      supabase,
      "cautela_items",
      "id, cautela_id, material_id, status, quantity_delivered, quantity_returned"
    ),
  ])

  const pistols = materials.filter(isGlock9mmPistol)
  const poolChargers = materials.filter(isGlock9mmCharger)
  const N = pistols.length
  const T = targetChargerCount(N)
  const stats = countPoolChargersByStatus(poolChargers)
  const C = stats.total

  const pendingItemMaterialIds = new Set(
    items.filter((i) => i.status === "pending").map((i) => i.material_id)
  )

  const plan = { insert: [], retire: [] }

  if (C < T) {
    const mk = nextPoolPatrimony(poolChargers)
    for (let i = 1; i <= T - C; i++) {
      const ids = mk(i)
      plan.insert.push({
        ...ids,
        category: "CARREGADOR",
        calibre: "9mm",
        status: "available",
      })
    }
  } else if (C > T) {
    let excess = C - T
    const removable = poolChargers
      .filter(
        (m) =>
          m.status === "available" &&
          !pendingItemMaterialIds.has(m.id) &&
          String(m.patrimony_number ?? "").startsWith(GLK_POOL_PATRIMONY_PREFIX)
      )
      .sort((a, b) => String(b.patrimony_number).localeCompare(String(a.patrimony_number)))

    for (const m of removable) {
      if (excess <= 0) break
      plan.retire.push({ id: m.id, patrimony: m.patrimony_number, action: "mark unavailable" })
      excess--
    }
    if (excess > 0) {
      plan.retire.push({
        note: `${excess} excesso não removido (em uso ou fora do prefixo POOL)`,
      })
    }
  }

  if (apply) {
    for (const row of plan.insert) {
      const { patrimony_number, internal_code, serial_number, name, category, calibre, status } = row
      const { error } = await supabase.from("materials").insert({
        patrimony_number,
        internal_code,
        serial_number,
        name,
        category,
        calibre,
        status,
      })
      if (error) throw new Error(`insert ${patrimony_number}: ${error.message}`)
    }
    for (const row of plan.retire) {
      if (!row.id) continue
      const { error } = await supabase
        .from("materials")
        .update({ status: "unavailable", notes: "sync-glock-charger-pool: excesso QA" })
        .eq("id", row.id)
      if (error) throw new Error(`retire ${row.patrimony}: ${error.message}`)
    }
  }

  const cautelaFlags = await findOpenCautelasMissingChargers(supabase, materials, openCautelas, items)

  const report = {
    mode: apply ? "apply" : "dry-run",
    note: "Regra 3×N é apenas seed QA teste_db — Nova Cautela usa qty livre limitada ao disponível.",
    pistols_glock_9mm: N,
    target_total_chargers: T,
    pool_total_before: C,
    pool_available_before: stats.available,
    pool_in_use_before: stats.inUse,
    insert_count: plan.insert.length,
    retire_count: plan.retire.filter((r) => r.id).length,
    cautelas_glock_missing_chargers: cautelaFlags.length,
    cautela_flags: cautelaFlags.slice(0, 30),
  }

  const md = [
    `# Sync pool carregadores Glock 9mm — ${report.mode}`,
    "",
    "> **Somente QA (teste_db).** Total alvo = 3 × pistolas Glock 9mm. **Não** é regra da Nova Cautela em runtime.",
    "",
    "| Métrica | Valor |",
    "|---------|-------|",
    `| Pistolas Glock 9mm (N) | ${N} |`,
    `| Alvo total carregadores (3×N) | ${T} |`,
    `| Pool total antes | ${C} |`,
    `| Disponíveis | ${stats.available} |`,
    `| Em uso (cautelado) | ${stats.inUse} |`,
    `| Inserir | ${plan.insert.length} |`,
    `| Retirar (available POOL) | ${plan.retire.filter((r) => r.id).length} |`,
    `| Cautelas Glock sem carregador | ${cautelaFlags.length} |`,
    "",
  ]

  if (cautelaFlags.length) {
    md.push("## Cautelas abertas com Glock sem linha de carregador", "")
    for (const f of cautelaFlags) {
      md.push(`- Cautela \`${f.cautela_id}\` (${f.status}): ${f.note}`)
    }
    md.push("")
  }

  writeFileSync(REPORT, md.join("\n"))
  console.log(JSON.stringify(report, null, 2))
  console.log(`Report: ${REPORT}`)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
