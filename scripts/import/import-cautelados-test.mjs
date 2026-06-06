/**
 * Importa cautelados para teste_bd (dry-run por padrão).
 *
 *   node scripts/import/parse-cautelados-docx.mjs
 *   node scripts/import/import-cautelados-test.mjs
 *   node scripts/import/import-cautelados-test.mjs --apply
 */
import { readFileSync, writeFileSync, existsSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { createClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"
import { loadCloneEnv, assertTestOnly, placeholderEmail, TEST_REF } from "./lib/env-clone.mjs"
import { serialVariants } from "./lib/parse-rows.mjs"
import { isChargerCategoryName, isWeaponCategoryName } from "./lib/category-match.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const PARSED = resolve(__dirname, "cautelados-1bpm.parsed.json")
const REPORT = resolve(__dirname, "dry-run-report.md")
const TEMP_PIN = "0000"

const apply = process.argv.includes("--apply")

function loadParsed() {
  if (!existsSync(PARSED)) {
    throw new Error(`Execute antes: node scripts/import/parse-cautelados-docx.mjs`)
  }
  return JSON.parse(readFileSync(PARSED, "utf8"))
}

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

function digitTokens(value) {
  const tokens = new Set()
  const s = String(value ?? "")
  const matches = s.match(/\d{2,}/g) || []
  for (const m of matches) {
    tokens.add(m)
    const stripped = m.replace(/^0+/, "") || "0"
    tokens.add(stripped)
    if (stripped.length <= 4) tokens.add(stripped.padStart(3, "0"))
  }
  return [...tokens]
}

function buildMaterialIndex(materials) {
  const bySerial = new Map()
  const byDigitToken = new Map()
  for (const m of materials) {
    for (const v of serialVariants(m.serial_number)) {
      if (!bySerial.has(v)) bySerial.set(v, m)
    }
    if (m.patrimony_number) {
      for (const v of serialVariants(m.patrimony_number.replace(/^PAT-?/i, ""))) {
        if (!bySerial.has(v)) bySerial.set(v, m)
      }
    }
    for (const token of digitTokens(m.serial_number)) {
      if (!byDigitToken.has(token)) byDigitToken.set(token, m)
    }
    for (const token of digitTokens(m.patrimony_number)) {
      if (!byDigitToken.has(token)) byDigitToken.set(token, m)
    }
  }
  return { bySerial, byDigitToken }
}

function pickChargerMaterial(materials, personId, openItemKeys) {
  const candidates = materials.filter(
    (m) =>
      isChargerCategoryName(m.category || "") &&
      (m.status === "available" || m.status === "cautelado") &&
      !openItemKeys.has(`${personId}:${m.id}`)
  )
  return candidates[0] || null
}

async function insertCautelaItem(supabase, { cautelaId, materialId, quantity, report, context }) {
  const { error: ciErr } = await supabase.from("cautela_items").insert({
    cautela_id: cautelaId,
    material_id: materialId,
    status: "pending",
    quantity_delivered: quantity,
  })
  if (ciErr) {
    report.errors.push({ ...context, step: "cautela_item", message: ciErr.message })
    return false
  }
  const { error: mErr } = await supabase
    .from("materials")
    .update({ status: "cautelado", updated_at: new Date().toISOString() })
    .eq("id", materialId)
  if (mErr) {
    report.errors.push({ ...context, step: "material_status", message: mErr.message })
  }
  return true
}

function resolveMaterial(index, row) {
  const { bySerial, byDigitToken } = index
  for (const v of row.serial_variants) {
    const m = bySerial.get(v)
    if (m) return { material: m, matched: v, strategy: "serial_exact" }
  }
  for (const v of row.serial_variants) {
    if (v.length < 2 || !/^\d+$/.test(v)) continue
    const m = byDigitToken.get(v)
    if (m) return { material: m, matched: v, strategy: "digit_token" }
  }
  return null
}

function groupByPerson(rows) {
  const map = new Map()
  for (const row of rows) {
    const key = row.registration_number
    if (!map.has(key)) map.set(key, { person: row, items: [] })
    map.get(key).items.push(row)
  }
  return map
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

  const parsed = loadParsed()
  const { rows } = parsed

  const [persons, materials, profiles, cautelas, cautelaItems] = await Promise.all([
    fetchAll(supabase, "persons", "id, full_name, rg, registration_number, email"),
    fetchAll(supabase, "materials", "id, name, serial_number, patrimony_number, status, category"),
    fetchAll(supabase, "profiles", "id, name, role, is_active"),
    fetchAll(supabase, "cautelas", "id, person_id, status"),
    fetchAll(supabase, "cautela_items", "id, cautela_id, material_id, status"),
  ])

  const operator =
    profiles.find((p) => p.role === "supervisor" && p.is_active !== false) ||
    profiles.find((p) => p.role === "operator" && p.is_active !== false) ||
    profiles[0]
  if (!operator) throw new Error("Nenhum profile operador em teste_bd")

  const personByReg = new Map(persons.map((p) => [p.registration_number, p]))
  const personByRg = new Map(persons.map((p) => [p.rg, p]))
  const materialIndex = buildMaterialIndex(materials)

  const cautelaByPerson = new Map()
  for (const c of cautelas.filter((c) => c.status === "open")) {
    if (!cautelaByPerson.has(c.person_id)) cautelaByPerson.set(c.person_id, c.id)
  }
  const openItemKeys = new Set()
  const cautelaIdByPerson = new Map()
  for (const c of cautelas) cautelaIdByPerson.set(c.id, c.person_id)
  for (const ci of cautelaItems) {
    if (ci.status !== "pending") continue
    const pid = cautelaIdByPerson.get(ci.cautela_id)
    if (pid) openItemKeys.add(`${pid}:${ci.material_id}`)
  }

  const report = {
    mode: apply ? "apply" : "dry-run",
    testRef: TEST_REF,
    sourceFile: parsed.sourceFile,
    importableLines: rows.length,
    personsExisting: [],
    personsToCreate: [],
    materialsNotFound: [],
    itemsToCreate: [],
    chargerLinesToAdd: [],
    chargersNotFound: [],
    itemsSkippedExists: [],
    cautelasToCreate: 0,
    errors: [],
  }

  const pinHash = await bcrypt.hash(TEMP_PIN, 10)
  const groups = groupByPerson(rows)

  for (const [reg, group] of groups) {
    let person = personByReg.get(reg) || personByRg.get(group.person.rg)
    if (person) {
      report.personsExisting.push({
        registration_number: reg,
        id: person.id,
        full_name: person.full_name,
      })
    } else {
      const newPerson = {
        full_name: group.person.full_name,
        email: placeholderEmail(reg),
        rg: reg,
        registration_number: reg,
        function: group.person.patente || null,
        pin_hash: pinHash,
        phone: null,
        rg_front_url: null,
        rg_back_url: null,
        face_descriptor: null,
        status: "active",
      }
      report.personsToCreate.push({
        registration_number: reg,
        full_name: newPerson.full_name,
        email: newPerson.email,
      })
      if (apply) {
        const { data, error } = await supabase.from("persons").insert(newPerson).select("id").single()
        if (error) {
          report.errors.push({ step: "person", reg, message: error.message })
          continue
        }
        person = { id: data.id, ...newPerson }
        personByReg.set(reg, person)
      } else {
        person = { id: `dry-run-${reg}`, registration_number: reg }
      }
    }

    let cautelaId = apply ? cautelaByPerson.get(person.id) : null
    const notesParts = [
      ...new Set(group.items.map((i) => [i.data, i.destino].filter(Boolean).join(" ")).filter(Boolean)),
    ]
    const notes = `Importação legado 1º BPM. ${notesParts.slice(0, 3).join("; ")}`.slice(0, 500)

    if (apply && !cautelaId) {
      const first = group.items[0]
      const { data: cData, error: cErr } = await supabase
        .from("cautelas")
        .insert({
          person_id: person.id,
          operator_id: operator.id,
          type: "permanent",
          status: "open",
          notes,
          destino: first.destino,
          situacao_legado: first.situacao,
        })
        .select("id")
        .single()
      if (cErr) {
        report.errors.push({ step: "cautela", reg, message: cErr.message })
        continue
      }
      cautelaId = cData.id
      cautelaByPerson.set(person.id, cautelaId)
      report.cautelasToCreate++
    } else if (!apply) {
      report.cautelasToCreate++
    }

    for (const item of group.items) {
      const resolved = resolveMaterial(materialIndex, item)
      if (!resolved) {
        report.materialsNotFound.push({
          registration_number: reg,
          nome: item.full_name,
          serial: item.serial_raw,
          categoria: item.categoria,
        })
        continue
      }
      const mat = resolved.material
      const key = `${person.id}:${mat.id}`
      if (openItemKeys.has(key)) {
        report.itemsSkippedExists.push({
          reg,
          material_id: mat.id,
          serial: item.serial_raw,
        })
        continue
      }

      const qtyDelivered = item.quantity_delivered ?? item.quantity ?? 1
      const chargerQty = item.charger_qty ?? 0
      const weaponRow =
        item.is_weapon_row ?? isWeaponCategoryName(item.categoria) || isWeaponCategoryName(mat.category || "")

      report.itemsToCreate.push({
        registration_number: reg,
        person_name: item.full_name,
        material_id: mat.id,
        material_name: mat.name,
        serial: item.serial_raw,
        matched: resolved.matched,
        quantity: qtyDelivered,
        charger_qty: weaponRow ? chargerQty : 0,
        material_status_before: mat.status,
      })

      if (weaponRow && chargerQty > 0) {
        const chargerMat = pickChargerMaterial(materials, person.id, openItemKeys)
        if (!chargerMat) {
          report.chargersNotFound.push({
            registration_number: reg,
            person_name: item.full_name,
            weapon_serial: item.serial_raw,
            charger_qty: chargerQty,
          })
        } else {
          const chargerKey = `${person.id}:${chargerMat.id}`
          if (!openItemKeys.has(chargerKey)) {
            report.chargerLinesToAdd.push({
              registration_number: reg,
              person_name: item.full_name,
              weapon_material: mat.name,
              weapon_serial: item.serial_raw,
              charger_material_id: chargerMat.id,
              charger_material_name: chargerMat.name,
              charger_qty: chargerQty,
            })
          }
        }
      }

      if (apply) {
        const ok = await insertCautelaItem(supabase, {
          cautelaId,
          materialId: mat.id,
          quantity: qtyDelivered,
          report,
          context: { reg, serial: item.serial_raw },
        })
        if (!ok) continue
        openItemKeys.add(key)

        if (weaponRow && chargerQty > 0) {
          const chargerMat = pickChargerMaterial(materials, person.id, openItemKeys)
          if (!chargerMat) {
            report.chargersNotFound.push({
              registration_number: reg,
              person_name: item.full_name,
              weapon_serial: item.serial_raw,
              charger_qty: chargerQty,
            })
          } else {
            const chargerKey = `${person.id}:${chargerMat.id}`
            if (!openItemKeys.has(chargerKey)) {
              const cOk = await insertCautelaItem(supabase, {
                cautelaId,
                materialId: chargerMat.id,
                quantity: chargerQty,
                report,
                context: { reg, serial: item.serial_raw, kind: "charger" },
              })
              if (cOk) openItemKeys.add(chargerKey)
            }
          }
        }
      }
    }
  }

  const md = formatReport(report, parsed, operator)
  writeFileSync(REPORT, md, "utf8")
  console.log(md)
  console.log(`\nRelatório: ${REPORT}`)
  if (!apply) {
    console.log("\nDry-run. Para aplicar: node scripts/import/import-cautelados-test.mjs --apply")
  }
}

function formatReport(report, parsed, operator) {
  const lines = [
    `# Importação cautelados — ${report.mode}`,
    "",
    `Gerado: ${new Date().toISOString()}`,
    `Fonte: ${parsed.sourceFile}`,
    `Banco: teste_bd (\`${report.testRef}\`)`,
    `Operador import: ${operator.name} (${operator.role}, \`${operator.id}\`)`,
    "",
    "## Resumo",
    "",
    `| Métrica | Valor |`,
    `|--------|-------|`,
    `| Linhas importáveis (parse) | ${parsed.importableCount} |`,
    `| Pessoas já existentes | ${report.personsExisting.length} |`,
    `| Pessoas a criar | ${report.personsToCreate.length} |`,
    `| Cautelas a criar (grupos) | ${report.cautelasToCreate} |`,
    `| Itens de cautela a criar | ${report.itemsToCreate.length} |`,
    `| Linhas de carregador (extras) | ${report.chargerLinesToAdd.length} |`,
    `| Carregador não encontrado no estoque | ${report.chargersNotFound.length} |`,
    `| Itens já vinculados (skip) | ${report.itemsSkippedExists.length} |`,
    `| Materiais não encontrados | ${report.materialsNotFound.length} |`,
    `| Erros | ${report.errors.length} |`,
    "",
    "**PIN temporário** (todas as pessoas novas): `0000` — trocar no balcão.",
    "**E-mail placeholder**: `pendente+<matrícula>@cadastro.reserva.local`",
    "",
  ]

  if (report.personsToCreate.length) {
    lines.push("## Pessoas a criar", "")
    for (const p of report.personsToCreate.slice(0, 50)) {
      lines.push(`- ${p.full_name} — matr. ${p.registration_number} — ${p.email}`)
    }
    if (report.personsToCreate.length > 50) lines.push(`- … +${report.personsToCreate.length - 50}`)
    lines.push("")
  }

  if (report.chargerLinesToAdd.length) {
    lines.push("## Linhas de carregador a adicionar (arma qty=1)", "")
    for (const c of report.chargerLinesToAdd.slice(0, 40)) {
      lines.push(
        `- ${c.person_name} | arma \`${c.weapon_serial}\` → ${c.charger_qty}x ${c.charger_material_name}`
      )
    }
    if (report.chargerLinesToAdd.length > 40) {
      lines.push(`- … +${report.chargerLinesToAdd.length - 40}`)
    }
    lines.push("")
  }

  if (report.chargersNotFound.length) {
    lines.push("## Armas com carregadores no CSV sem material Carregador disponível", "")
    for (const c of report.chargersNotFound) {
      lines.push(`- ${c.person_name} | serial \`${c.weapon_serial}\` | qty ${c.charger_qty}`)
    }
    lines.push("")
  }

  if (report.materialsNotFound.length) {
    lines.push("## Materiais não encontrados (serial)", "")
    for (const m of report.materialsNotFound) {
      lines.push(`- ${m.nome} | serial \`${m.serial}\` | ${m.categoria}`)
    }
    lines.push("")
  }

  if (report.errors.length) {
    lines.push("## Erros", "")
    for (const e of report.errors) {
      lines.push(`- ${JSON.stringify(e)}`)
    }
  }

  return lines.join("\n")
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
