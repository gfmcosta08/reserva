/**
 * Adiciona linhas de carregador Glock 9mm em cautelas open/partial legadas (import sem pool).
 *
 *   node scripts/import/backfill-glock-charger-lines.mjs
 *   node scripts/import/backfill-glock-charger-lines.mjs --apply
 */
import { writeFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { createClient } from "@supabase/supabase-js"
import { loadCloneEnv, assertTestOnly, TEST_REF } from "./lib/env-clone.mjs"
import {
  isChargerMaterial,
  isGlock9mmCharger,
  isGlock9mmPistol,
} from "./lib/glock-9mm-inventory.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPORT = resolve(__dirname, "backfill-glock-charger-lines-report.md")
const apply = process.argv.includes("--apply")
const CHARGERS_PER_GLOCK = 3

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

function findMissingChargerCautelas(materials, openCautelas, items) {
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
    const lines = itemsByCautela.get(c.id) ?? []
    const hasGlock = lines.some((i) => {
      const m = matById.get(i.material_id)
      return m && isGlock9mmPistol(m)
    })
    if (!hasGlock) continue

    const chargerLines = lines.filter((i) => {
      const m = matById.get(i.material_id)
      return m && isChargerMaterial(m) && (i.status === "pending" || i.status === "returned")
    })
    if (chargerLines.length >= 1) continue

    flags.push({ cautela: c, lines })
  }
  return flags
}

function pickPoolChargers(materials, usedIds, count) {
  const picked = []
  for (const m of materials) {
    if (picked.length >= count) break
    if (!isGlock9mmCharger(m)) continue
    if (m.status !== "available") continue
    if (usedIds.has(m.id)) continue
    picked.push(m)
    usedIds.add(m.id)
  }
  return picked
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
      "id, name, category, calibre, marca, patrimony_number, serial_number, status"
    ),
    fetchAll(supabase, "cautelas", "id, person_id, status").then((rows) =>
      rows.filter((c) => c.status === "open" || c.status === "partial")
    ),
    fetchAll(
      supabase,
      "cautela_items",
      "id, cautela_id, material_id, status, quantity_delivered, quantity_returned"
    ),
  ])

  const pendingMaterialIds = new Set(
    items.filter((i) => i.status === "pending").map((i) => i.material_id)
  )
  const usedChargerIds = new Set(pendingMaterialIds)
  const targets = findMissingChargerCautelas(materials, openCautelas, items)

  const report = {
    mode: apply ? "apply" : "dry-run",
    testRef: TEST_REF,
    chargers_per_glock: CHARGERS_PER_GLOCK,
    cautelas_to_fix: targets.length,
    fixes: [],
    insufficient_pool: [],
    errors: [],
  }

  for (const { cautela, lines } of targets) {
    const existingMaterialIds = new Set(lines.map((l) => l.material_id))
    const localUsed = new Set(usedChargerIds)
    for (const id of existingMaterialIds) localUsed.add(id)

    const chargers = pickPoolChargers(materials, localUsed, CHARGERS_PER_GLOCK)
    if (chargers.length < CHARGERS_PER_GLOCK) {
      report.insufficient_pool.push({
        cautela_id: cautela.id,
        person_id: cautela.person_id,
        needed: CHARGERS_PER_GLOCK,
        found: chargers.length,
      })
      continue
    }

    const fix = {
      cautela_id: cautela.id,
      person_id: cautela.person_id,
      status: cautela.status,
      chargers: chargers.map((c) => ({
        id: c.id,
        patrimony: c.patrimony_number,
        name: c.name,
      })),
    }
    report.fixes.push(fix)

    if (apply) {
      for (const charger of chargers) {
        const { error: insErr } = await supabase.from("cautela_items").insert({
          cautela_id: cautela.id,
          material_id: charger.id,
          status: "pending",
          quantity_delivered: 1,
        })
        if (insErr) {
          report.errors.push({
            cautela_id: cautela.id,
            charger_id: charger.id,
            step: "insert",
            message: insErr.message,
          })
          continue
        }
        const { error: upErr } = await supabase
          .from("materials")
          .update({ status: "cautelado", updated_at: new Date().toISOString() })
          .eq("id", charger.id)
        if (upErr) {
          report.errors.push({
            cautela_id: cautela.id,
            charger_id: charger.id,
            step: "material_status",
            message: upErr.message,
          })
        }
        usedChargerIds.add(charger.id)
        charger.status = "cautelado"
      }
    } else {
      for (const c of chargers) usedChargerIds.add(c.id)
    }
  }

  const md = [
    `# Backfill linhas carregador Glock — ${report.mode}`,
    "",
    `Gerado: ${new Date().toISOString()}`,
    `Banco: teste_db (\`${report.testRef}\`)`,
    "",
    "| Métrica | Valor |",
    "|---------|-------|",
    `| Carregadores por Glock | ${CHARGERS_PER_GLOCK} |`,
    `| Cautelas alvo | ${targets.length} |`,
    `| Correções aplicáveis | ${report.fixes.length} |`,
    `| Pool insuficiente | ${report.insufficient_pool.length} |`,
    `| Erros | ${report.errors.length} |`,
    "",
  ]

  if (report.fixes.length) {
    md.push("## Correções", "")
    for (const f of report.fixes.slice(0, 50)) {
      const names = f.chargers.map((c) => c.patrimony).join(", ")
      md.push(`- Cautela \`${f.cautela_id}\` (${f.status}): +${f.chargers.length} carregadores (${names})`)
    }
    if (report.fixes.length > 50) md.push(`- … +${report.fixes.length - 50} cautelas`)
    md.push("")
  }

  if (report.insufficient_pool.length) {
    md.push("## Pool insuficiente", "")
    for (const row of report.insufficient_pool) {
      md.push(`- Cautela \`${row.cautela_id}\`: precisava ${row.needed}, encontrou ${row.found}`)
    }
    md.push("")
  }

  writeFileSync(REPORT, md.join("\n"))
  console.log(JSON.stringify(report, null, 2))
  console.log(`Report: ${REPORT}`)
  if (!apply) {
    console.log("\nDry-run. Para aplicar: node scripts/import/backfill-glock-charger-lines.mjs --apply")
  }
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
