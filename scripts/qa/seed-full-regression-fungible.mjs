/**
 * Seed E2E-08: material fungível (estoque 20) para validar redução na saída da cautela.
 *   node scripts/qa/seed-full-regression-fungible.mjs --apply
 */
import { readFileSync, writeFileSync, existsSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { createClient } from "@supabase/supabase-js"
import { loadCloneEnv, assertTestOnly } from "../import/lib/env-clone.mjs"
import { getDefaultTenantIds, withTenant } from "../import/lib/tenant-default.mjs"
import { setMaterialAvailable } from "./lib/tenant-seed.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const QA_ENV_PATH = resolve(__dirname, "../.env.qa")
const apply = process.argv.includes("--apply")

const PATRIMONY = "PAT-QA-FUNG-001"
const INITIAL_STOCK = 20
const MATERIAL = {
  name: "QA ESTOQUE FUNGIVEL E2E",
  category: "COLETE BALISTICO",
  patrimony_number: PATRIMONY,
  internal_code: "QA-FUNG-001",
  serial_number: "SN-QA-FUNG-001",
  status: "available",
  stock_quantity: INITIAL_STOCK,
  notes: "Seed E2E-08 — estoque fungível para regressão",
}

function appendQaEnv(key, value) {
  let content = existsSync(QA_ENV_PATH) ? readFileSync(QA_ENV_PATH, "utf8") : ""
  const re = new RegExp(`^${key}=.*$`, "m")
  const line = `${key}=${value}`
  content = re.test(content) ? content.replace(re, line) : `${content.replace(/\s*$/, "")}\n${line}\n`
  writeFileSync(QA_ENV_PATH, content, "utf8")
}

async function resetOpenCautelasForMaterial(supabase, materialId) {
  const { data: items } = await supabase
    .from("cautela_items")
    .select("id, cautela_id, quantity_delivered, quantity_returned, status")
    .eq("material_id", materialId)
    .in("status", ["pending", "returned"])

  const cautelaIds = [...new Set((items ?? []).map((i) => i.cautela_id))]
  for (const cautelaId of cautelaIds) {
    const { data: cautela } = await supabase.from("cautelas").select("status").eq("id", cautelaId).maybeSingle()
    if (!cautela || !["open", "partial"].includes(cautela.status)) continue
    await supabase.from("cautela_items").delete().eq("cautela_id", cautelaId)
    await supabase.from("cautelas").delete().eq("id", cautelaId)
  }
}

async function main() {
  const env = loadCloneEnv()
  assertTestOnly(env.SUPABASE_TEST_URL)
  const supabase = createClient(env.SUPABASE_TEST_URL, env.SUPABASE_TEST_SERVICE_ROLE_KEY)

  const { data: existing } = await supabase
    .from("materials")
    .select("id, patrimony_number, stock_quantity, status")
    .eq("patrimony_number", PATRIMONY)
    .maybeSingle()

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          dry_run: true,
          patrimony: PATRIMONY,
          initial_stock: INITIAL_STOCK,
          exists: Boolean(existing),
        },
        null,
        2
      )
    )
    return
  }

  const tenant = await getDefaultTenantIds(supabase)
  const row = withTenant(MATERIAL, tenant)
  let materialId = existing?.id

  if (materialId) {
    await resetOpenCautelasForMaterial(supabase, materialId)
    await setMaterialAvailable(supabase, materialId, INITIAL_STOCK)
    const { error } = await supabase
      .from("materials")
      .update({ ...row, name: MATERIAL.name, category: MATERIAL.category })
      .eq("id", materialId)
    if (error) throw error
  } else {
    const { data, error } = await supabase.from("materials").insert(row).select("id").single()
    if (error) throw error
    materialId = data.id
  }

  appendQaEnv("E2E_FUNGIBLE_PATRIMONY", PATRIMONY)
  appendQaEnv("E2E_FUNGIBLE_INITIAL_STOCK", String(INITIAL_STOCK))
  appendQaEnv("E2E_FUNGIBLE_MATERIAL_ID", materialId)

  console.log(
    JSON.stringify(
      {
        ok: true,
        material_id: materialId,
        patrimony: PATRIMONY,
        initial_stock: INITIAL_STOCK,
        checkout_qty: 5,
        expected_stock_after: INITIAL_STOCK - 5,
      },
      null,
      2
    )
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
