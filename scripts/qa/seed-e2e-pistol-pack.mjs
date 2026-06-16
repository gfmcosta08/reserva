/**
 * Pacote pistola E2E no teste_db: pistola + 3 carregadores dedicados + munição com estoque.
 * Dados ficam SOMENTE no teste_db — nunca promover para produção.
 *
 *   node scripts/qa/seed-e2e-pistol-pack.mjs --apply
 */
import { readFileSync, writeFileSync, existsSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { createClient } from "@supabase/supabase-js"
import { loadCloneEnv, assertTestOnly } from "../import/lib/env-clone.mjs"
import { getDefaultTenantIds, withTenant } from "../import/lib/tenant-default.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const QA_ENV_PATH = resolve(__dirname, "../.env.qa")
const apply = process.argv.includes("--apply")

const PISTOL = {
  name: "PISTOLA QA E2E",
  category: "ARMA CURTA",
  patrimony_number: "PAT-E2E-GLK-001",
  internal_code: "E2E-GLK-001",
  serial_number: "SN-E2E-GLK-001",
  marca: "Glock",
  modelo: "G17 Gen 5",
  calibre: "9mm",
  status: "available",
  stock_quantity: 1,
}

const CHARGERS = [1, 2, 3].map((n) => ({
  name: `CARREGADOR QA E2E GLOCK 9MM ${n}`,
  category: "CARREGADOR",
  patrimony_number: `PAT-E2E-GLK-CHG-${String(n).padStart(3, "0")}`,
  internal_code: `E2E-GLK-CHG-${String(n).padStart(3, "0")}`,
  serial_number: `SN-E2E-CHG-${String(n).padStart(3, "0")}`,
  marca: "Glock",
  calibre: "9mm",
  status: "available",
  stock_quantity: 1,
}))

const AMMO = {
  name: "MUNICAO 9MM (QA DISPONÍVEL)",
  category: "MUNICAO",
  patrimony_number: "PAT-QA-MUN-001",
  internal_code: "QA-MUN-001",
  calibre: "9mm",
  status: "available",
  stock_quantity: 500,
}

function appendQaEnv(vars) {
  let content = existsSync(QA_ENV_PATH) ? readFileSync(QA_ENV_PATH, "utf8") : ""
  for (const [key, value] of Object.entries(vars)) {
    const re = new RegExp(`^${key}=.*$`, "m")
    const line = `${key}=${value}`
    content = re.test(content) ? content.replace(re, line) : `${content.replace(/\s*$/, "")}\n${line}\n`
  }
  writeFileSync(QA_ENV_PATH, content, "utf8")
}

async function resetOpenCautelasForMaterial(supabase, materialId) {
  const { data: items } = await supabase
    .from("cautela_items")
    .select("cautela_id")
    .eq("material_id", materialId)

  for (const cautelaId of [...new Set((items ?? []).map((i) => i.cautela_id))]) {
    const { data: cautela } = await supabase.from("cautelas").select("status").eq("id", cautelaId).maybeSingle()
    if (!cautela || !["open", "partial"].includes(cautela.status)) continue
    await supabase.from("cautela_items").delete().eq("cautela_id", cautelaId)
    await supabase.from("cautelas").delete().eq("id", cautelaId)
  }
}

async function ensureMaterial(supabase, spec, tenant) {
  const row = withTenant(spec, tenant)
  const { data: existing } = await supabase
    .from("materials")
    .select("id, status")
    .eq("patrimony_number", row.patrimony_number)
    .maybeSingle()

  if (existing) {
    if (apply) {
      await resetOpenCautelasForMaterial(supabase, existing.id)
      await supabase
        .from("materials")
        .update({ ...row, status: "available", status_atual: "DISPONIVEL" })
        .eq("id", existing.id)
    }
    return { action: "updated", id: existing.id, patrimony: spec.patrimony_number }
  }

  if (apply) {
    const { data, error } = await supabase.from("materials").insert(row).select("id").single()
    if (error) throw error
    return { action: "inserted", id: data.id, patrimony: spec.patrimony_number }
  }
  return { action: "would insert", patrimony: spec.patrimony_number }
}

async function main() {
  const env = loadCloneEnv()
  assertTestOnly(env.SUPABASE_TEST_URL)
  const supabase = createClient(env.SUPABASE_TEST_URL, env.SUPABASE_TEST_SERVICE_ROLE_KEY)
  const tenant = await getDefaultTenantIds(supabase)

  const pistol = await ensureMaterial(supabase, PISTOL, tenant)
  const chargers = []
  for (const c of CHARGERS) {
    chargers.push(await ensureMaterial(supabase, c, tenant))
  }
  const ammo = await ensureMaterial(supabase, AMMO, tenant)

  if (apply) {
    appendQaEnv({
      E2E_PISTOL_PATRIMONY: PISTOL.patrimony_number,
      E2E_PISTOL_CHARGER_PATRIMONIES: CHARGERS.map((c) => c.patrimony_number).join(","),
      E2E_AMMO_PATRIMONY: AMMO.patrimony_number,
    })
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        apply,
        note: "Fixtures QA — somente teste_db. Código promove para prod; estes dados não.",
        pistol,
        chargers,
        ammo,
        pack_ready: apply ? "pistola + 3 carregadores + munição 500 disponíveis" : "dry-run",
      },
      null,
      2
    )
  )
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
