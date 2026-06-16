/**
 * Diagnóstico: pistolas Glock disponíveis vs resolução de pacote (carregador/munição).
 * Usa teste_db — não toca produção.
 *
 *   node scripts/qa/diagnose-pack-resolution.mjs
 */
import { createClient } from "@supabase/supabase-js"
import { loadCloneEnv, assertTestOnly } from "../import/lib/env-clone.mjs"

const CHARGER_OR =
  "category.ilike.%carregador%,category.ilike.%pente%,name.ilike.%carregador%,name.ilike.%pente%"
const AMMO_OR =
  "category.ilike.%municao%,category.ilike.%muni%,name.ilike.%municao%,name.ilike.%muni%,name.ilike.%cartucho%,name.ilike.%projetil%"

function effectiveStock(m) {
  if (m.stock_quantity == null) return 1
  return Math.max(0, m.stock_quantity)
}

function canReserve(m, qty = 1) {
  if (m.status && m.status !== "available") return false
  return effectiveStock(m) >= qty
}

function isGlock9mmPistol(m) {
  const name = (m.name || "").toLowerCase()
  const marca = (m.marca || "").toLowerCase()
  const cat = (m.category || "").toLowerCase()
  const isGlock = name.includes("glock") || marca.includes("glock")
  const isPistol = cat.includes("pistola") || name.includes("pistola")
  const cal = (m.calibre || "").toLowerCase()
  const is9 = cal.includes("9mm") || cal === "9" || name.includes("9mm")
  const isCharger = cat.includes("carregador") || name.includes("carregador")
  return isGlock && isPistol && is9 && !isCharger
}

async function fetchAll(supabase, filter) {
  const rows = []
  let from = 0
  while (from < 5000) {
    const { data, error } = await supabase
      .from("materials")
      .select("id, name, patrimony_number, category, calibre, marca, status, stock_quantity")
      .eq("status", "available")
      .or(filter)
      .order("name")
      .range(from, from + 499)
    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
    if (data.length < 500) break
    from += 500
  }
  return rows.filter((m) => canReserve(m, 1))
}

async function main() {
  const env = loadCloneEnv()
  assertTestOnly(env.SUPABASE_TEST_URL)
  const supabase = createClient(env.SUPABASE_TEST_URL, env.SUPABASE_TEST_SERVICE_ROLE_KEY)

  const pistols = (await fetchAll(supabase, "name.ilike.%glock%,marca.ilike.%glock%")).filter(isGlock9mmPistol)
  const chargers = await fetchAll(supabase, CHARGER_OR)
  const ammo = await fetchAll(supabase, AMMO_OR)

  console.log("\n=== Diagnóstico pacote pistola (teste_db) ===\n")
  console.log(`Pistolas Glock 9mm reserváveis: ${pistols.length}`)
  console.log(`Carregadores reserváveis (total): ${chargers.length}`)
  console.log(`Munição reservável (total): ${ammo.length}`)

  const chargersNoCalibre = chargers.filter((c) => !(c.calibre || "").trim())
  const ammoNoCalibre = ammo.filter((a) => !(a.calibre || "").trim())
  console.log(`Carregadores sem calibre no cadastro: ${chargersNoCalibre.length}`)
  console.log(`Munição sem calibre no cadastro: ${ammoNoCalibre.length}`)

  if (pistols.length === 0) {
    console.log("\n⚠ Nenhuma pistola Glock 9mm available — rode bootstrap-teste-db.")
    return
  }

  const sample = pistols[0]
  console.log(`\nAmostra: ${sample.name} (${sample.patrimony_number}) calibre=${sample.calibre || "(vazio)"}`)

  const compatibleChargers = chargers.filter((c) => {
    const wCal = (sample.calibre || "").trim()
    const mCal = (c.calibre || "").trim()
    if (wCal && mCal && wCal !== mCal && !mCal.includes("9mm") && !wCal.includes(mCal)) return false
    return true
  })

  console.log(`Carregadores compatíveis (regra relaxada): ${compatibleChargers.length}`)
  console.log(`Munição compatível (regra relaxada): ${ammo.length}`)

  if (compatibleChargers.length < 3) {
    console.log("\n❌ Menos de 3 carregadores — pacote pistola falha mesmo com regra corrigida.")
  } else {
    console.log("\n✓ Pacote pistola deve funcionar com a regra corrigida (≥3 carregadores).")
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
