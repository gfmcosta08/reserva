/**
 * Reclassifica cautelas marcadas divergent por saldo de quantidade (bug legado).
 * Divergente real = apenas damaged/missing.
 *
 *   node scripts/import/fix-divergent-to-partial.mjs
 *   node scripts/import/fix-divergent-to-partial.mjs --apply
 */
import { writeFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { createClient } from "@supabase/supabase-js"
import { loadCloneEnv, assertTestOnly, TEST_REF } from "./lib/env-clone.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const apply = process.argv.includes("--apply")

function hasTrueDivergence(items) {
  return items.some((i) => i.status === "damaged" || i.status === "missing")
}

function computeStatus(items) {
  if (hasTrueDivergence(items)) return "divergent"
  const allReturned = items.every(
    (i) => i.status === "returned" && (i.quantity_returned || 0) >= (i.quantity_delivered || 1)
  )
  if (allReturned && items.length) return "closed"
  const anyProgress = items.some(
    (i) =>
      i.status !== "pending" ||
      (i.status === "pending" && (i.quantity_returned || 0) > 0) ||
      (i.status === "returned" && (i.quantity_returned || 0) < (i.quantity_delivered || 1))
  )
  if (anyProgress) return "partial"
  return "open"
}

async function main() {
  const env = loadCloneEnv()
  assertTestOnly(env.SUPABASE_TEST_URL)
  const supabase = createClient(env.SUPABASE_TEST_URL, env.SUPABASE_TEST_SERVICE_ROLE_KEY)

  const { data: cautelas } = await supabase.from("cautelas").select("id, status, closed_at").eq("status", "divergent")
  const fixes = []

  for (const c of cautelas || []) {
    const { data: items } = await supabase
      .from("cautela_items")
      .select("id, status, quantity_delivered, quantity_returned")
      .eq("cautela_id", c.id)

    if (!items?.length) continue
    if (hasTrueDivergence(items)) continue

    const newStatus = computeStatus(items)
    if (newStatus === "divergent") continue

    const itemFixes = items.filter(
      (item) =>
        item.status === "returned" &&
        (item.quantity_returned || 0) < (item.quantity_delivered || 1)
    )

    fixes.push({ cautela_id: c.id, to: newStatus, itemFixes })

    if (apply) {
      for (const it of itemFixes) {
        await supabase.from("cautela_items").update({ status: "pending" }).eq("id", it.id)
      }
      await supabase
        .from("cautelas")
        .update({
          status: newStatus,
          closed_at: newStatus === "closed" ? c.closed_at : null,
        })
        .eq("id", c.id)
    }
  }

  const md = [
    `# Fix divergent → partial (${apply ? "apply" : "dry-run"})`,
    `Banco: teste_db (\`${TEST_REF}\`)`,
    `Cautelas a corrigir: ${fixes.length}`,
    "",
    ...fixes.map(
      (f) => `- \`${f.cautela_id}\` → **${f.to}** (${f.itemFixes.length} linha(s) reabertas)`
    ),
  ].join("\n")

  const out = resolve(__dirname, "fix-divergent-report.md")
  writeFileSync(out, md, "utf8")
  console.log(md)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
