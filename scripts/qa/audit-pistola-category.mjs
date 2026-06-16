/**
 * Auditoria: categorias PISTOLA vs ARMA CURTA (somente leitura, teste_db).
 *
 *   node scripts/qa/audit-pistola-category.mjs
 *   node scripts/qa/audit-pistola-category.mjs --json
 */
import { createClient } from "@supabase/supabase-js"
import { writeFileSync, mkdirSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { loadCloneEnv, assertTestOnly } from "../import/lib/env-clone.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const writeJson = process.argv.includes("--json")

function normCategory(cat) {
  return String(cat ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
}

function isPistolaCategory(cat) {
  const n = normCategory(cat)
  return n === "pistola" || n === "pistolas"
}

function isArmaCurtaCategory(cat) {
  return normCategory(cat) === "arma curta"
}

async function fetchAllMaterials(supabase) {
  const rows = []
  let from = 0
  while (from < 20000) {
    const { data, error } = await supabase
      .from("materials")
      .select("id, name, category, patrimony_number, serial_number, internal_code, status, updated_at")
      .order("patrimony_number")
      .range(from, from + 999)
    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
    if (data.length < 1000) break
    from += 1000
  }
  return rows
}

function findConflicts(pistolas, armaCurta, key) {
  const acByKey = new Map()
  for (const m of armaCurta) {
    const v = (m[key] || "").trim()
    if (!v) continue
    if (!acByKey.has(v)) acByKey.set(v, [])
    acByKey.get(v).push(m)
  }

  const conflicts = []
  for (const p of pistolas) {
    const v = (p[key] || "").trim()
    if (!v) continue
    const matches = acByKey.get(v)
    if (matches?.length) {
      conflicts.push({
        key,
        value: v,
        pistola: { id: p.id, name: p.name, category: p.category, patrimony_number: p.patrimony_number },
        arma_curta: matches.map((m) => ({
          id: m.id,
          name: m.name,
          category: m.category,
          patrimony_number: m.patrimony_number,
        })),
      })
    }
  }
  return conflicts
}

async function main() {
  const env = loadCloneEnv()
  assertTestOnly(env.SUPABASE_TEST_URL)
  const supabase = createClient(env.SUPABASE_TEST_URL, env.SUPABASE_TEST_SERVICE_ROLE_KEY)

  const all = await fetchAllMaterials(supabase)
  const pistolas = all.filter((m) => isPistolaCategory(m.category))
  const armaCurta = all.filter((m) => isArmaCurtaCategory(m.category))

  const patrimonyConflicts = findConflicts(pistolas, armaCurta, "patrimony_number")
  const serialConflicts = findConflicts(pistolas, armaCurta, "serial_number")
  const codeConflicts = findConflicts(pistolas, armaCurta, "internal_code")

  const pistolIds = pistolas.map((p) => p.id)
  let openCautelaRefs = []
  if (pistolIds.length > 0) {
    const { data: items, error } = await supabase
      .from("cautela_items")
      .select("id, material_id, cautela_id, status, cautelas(status)")
      .in("material_id", pistolIds)
    if (error) throw error
    openCautelaRefs = (items ?? []).filter((i) => {
      const st = i.cautelas?.status
      return st === "open" || st === "partial"
    })
  }

  const distinctCategories = [...new Set(all.map((m) => m.category).filter(Boolean))].sort()
  const pistolLikeCategories = distinctCategories.filter(isPistolaCategory)

  const report = {
    generated_at: new Date().toISOString(),
    database: "teste_db",
    totals: {
      materials: all.length,
      pistola_category: pistolas.length,
      arma_curta_category: armaCurta.length,
      pistol_like_category_labels: pistolLikeCategories,
    },
    conflicts: {
      patrimony_number: patrimonyConflicts,
      serial_number: serialConflicts,
      internal_code: codeConflicts,
    },
    conflict_counts: {
      patrimony_number: patrimonyConflicts.length,
      serial_number: serialConflicts.length,
      internal_code: codeConflicts.length,
    },
    open_cautela_items_on_pistola: openCautelaRefs.length,
    open_cautela_items_sample: openCautelaRefs.slice(0, 20),
    migrate_preview: pistolas
      .filter((p) => !patrimonyConflicts.some((c) => c.pistola.id === p.id))
      .length,
    delete_preview: patrimonyConflicts.length,
  }

  console.log("\n=== Auditoria PISTOLA → ARMA CURTA (teste_db) ===\n")
  console.log(`Materiais com categoria PISTOLA (variantes): ${pistolas.length}`)
  console.log(`Materiais com categoria ARMA CURTA: ${armaCurta.length}`)
  console.log(`Rótulos no banco tipo pistola: ${pistolLikeCategories.join(", ") || "(nenhum)"}`)
  console.log(`Conflitos por patrimônio: ${patrimonyConflicts.length}`)
  console.log(`Conflitos por serial: ${serialConflicts.length}`)
  console.log(`Conflitos por código interno: ${codeConflicts.length}`)
  console.log(`Itens de cautela aberta vinculados a PISTOLA: ${openCautelaRefs.length}`)
  console.log(`UPDATE previsto (sem conflito patrimônio): ${report.migrate_preview}`)
  console.log(`DELETE previsto (duplicado PISTOLA, manter ARMA CURTA): ${report.delete_preview}`)

  if (patrimonyConflicts.length > 0) {
    console.log("\n--- Amostra conflitos patrimônio ---")
    for (const c of patrimonyConflicts.slice(0, 10)) {
      console.log(`  ${c.value}: PISTOLA ${c.pistola.id} → manter ARMA CURTA ${c.arma_curta[0]?.id}`)
    }
  }

  if (writeJson) {
    const outDir = resolve(__dirname, "../../docs")
    mkdirSync(outDir, { recursive: true })
    const outPath = resolve(outDir, "audit-pistola-category.json")
    writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8")
    console.log(`\nJSON: ${outPath}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
