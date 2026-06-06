/**
 * Corrige cautelas open legadas: qty de carregadores na linha da arma → linha Carregador separada.
 *
 *   node scripts/import/backfill-charger-items.mjs
 *   node scripts/import/backfill-charger-items.mjs --apply
 */
import { writeFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { createClient } from "@supabase/supabase-js"
import { loadCloneEnv, assertTestOnly, TEST_REF } from "./lib/env-clone.mjs"
import { isChargerCategoryName, isWeaponCategoryName } from "./lib/category-match.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPORT = resolve(__dirname, "backfill-charger-report.md")
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

function pickChargerForCautela(materials, cautelaId, existingMaterialIds, usedChargerIds) {
  return materials.find(
    (m) =>
      isChargerCategoryName(m.category || "") &&
      (m.status === "available" || m.status === "cautelado") &&
      !existingMaterialIds.has(m.id) &&
      !usedChargerIds.has(`${cautelaId}:${m.id}`)
  )
}

async function main() {
  const env = loadCloneEnv()
  const url = env.SUPABASE_TEST_URL
  const key = env.SUPABASE_TEST_SERVICE_ROLE_KEY
  assertTestOnly(url)
  if (!key) throw new Error("SUPABASE_TEST_SERVICE_ROLE_KEY ausente em scripts/.env.clone")

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const [openCautelas, materials] = await Promise.all([
    fetchAll(supabase, "cautelas", "id, person_id, status").then((rows) =>
      rows.filter((c) => c.status === "open")
    ),
    fetchAll(supabase, "materials", "id, name, category, status"),
  ])

  const openIds = new Set(openCautelas.map((c) => c.id))
  const cautelaById = new Map(openCautelas.map((c) => [c.id, c]))

  const items = await fetchAll(
    supabase,
    "cautela_items",
    "id, cautela_id, material_id, status, quantity_delivered, quantity_returned"
  )

  const itemsOnOpen = items.filter((i) => openIds.has(i.cautela_id) && i.status === "pending")
  const matById = new Map(materials.map((m) => [m.id, m]))

  const itemsByCautela = new Map()
  for (const i of itemsOnOpen) {
    if (!itemsByCautela.has(i.cautela_id)) itemsByCautela.set(i.cautela_id, [])
    itemsByCautela.get(i.cautela_id).push(i)
  }

  const report = {
    mode: apply ? "apply" : "dry-run",
    testRef: TEST_REF,
    fixes: [],
    skipped: [],
    noChargerMaterial: [],
    errors: [],
  }

  const usedChargerIds = new Set()

  for (const item of itemsOnOpen) {
    const mat = matById.get(item.material_id)
    if (!mat) continue
    const cat = mat.category || ""
    const name = mat.name || ""
    if (isChargerCategoryName(cat) || isChargerCategoryName(name)) continue
    if (!isWeaponCategoryName(cat) && !isWeaponCategoryName(name)) continue
    if ((item.quantity_delivered || 1) <= 1) continue

    const cautelaId = item.cautela_id
    const cautelaItems = itemsByCautela.get(cautelaId) || []
    const alreadyHasChargerLine = cautelaItems.some((ci) => {
      const m = matById.get(ci.material_id)
      if (!m) return false
      return isChargerCategoryName(m.category || "") || isChargerCategoryName(m.name || "")
    })
    if (alreadyHasChargerLine) continue
    const oldQty = item.quantity_delivered
    const chargerQty = oldQty
    const existingMaterialIds = new Set(cautelaItems.map((ci) => ci.material_id))

    const chargerMat = pickChargerForCautela(
      materials,
      cautelaId,
      existingMaterialIds,
      usedChargerIds
    )

    if (!chargerMat) {
      report.noChargerMaterial.push({
        cautela_id: cautelaId,
        item_id: item.id,
        weapon: mat.name,
        charger_qty: chargerQty,
      })
      continue
    }

    const fix = {
      cautela_id: cautelaId,
      person_id: cautelaById.get(cautelaId)?.person_id,
      item_id: item.id,
      weapon_material_id: mat.id,
      weapon_name: mat.name,
      quantity_before: oldQty,
      weapon_quantity_after: 1,
      charger_material_id: chargerMat.id,
      charger_name: chargerMat.name,
      charger_quantity: chargerQty,
    }
    report.fixes.push(fix)

    if (apply) {
      const { error: upErr } = await supabase
        .from("cautela_items")
        .update({ quantity_delivered: 1 })
        .eq("id", item.id)
      if (upErr) {
        report.errors.push({ step: "update_weapon", item_id: item.id, message: upErr.message })
        continue
      }

      const { error: insErr } = await supabase.from("cautela_items").insert({
        cautela_id: cautelaId,
        material_id: chargerMat.id,
        status: "pending",
        quantity_delivered: chargerQty,
      })
      if (insErr) {
        report.errors.push({ step: "insert_charger", item_id: item.id, message: insErr.message })
        continue
      }

      await supabase
        .from("materials")
        .update({ status: "cautelado", updated_at: new Date().toISOString() })
        .eq("id", chargerMat.id)

      usedChargerIds.add(`${cautelaId}:${chargerMat.id}`)
      existingMaterialIds.add(chargerMat.id)
      cautelaItems.push({ material_id: chargerMat.id })
    }
  }

  const md = [
    `# Backfill carregadores — ${report.mode}`,
    "",
    `Gerado: ${new Date().toISOString()}`,
    `Banco: teste_db (\`${report.testRef}\`)`,
    "",
    `| Correções planejadas | ${report.fixes.length} |`,
    `| Sem carregador no estoque | ${report.noChargerMaterial.length} |`,
    `| Erros | ${report.errors.length} |`,
    "",
    "## Correções",
    "",
    ...report.fixes.map(
      (f) =>
        `- Cautela \`${f.cautela_id}\`: ${f.weapon_name} ${f.quantity_before}→1 + ${f.charger_quantity}x ${f.charger_name}`
    ),
    "",
  ].join("\n")

  writeFileSync(REPORT, md, "utf8")
  console.log(md)
  console.log(`\nRelatório: ${REPORT}`)
  if (!apply) {
    console.log("\nDry-run. Para aplicar: node scripts/import/backfill-charger-items.mjs --apply")
  }
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
