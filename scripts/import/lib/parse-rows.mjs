/**
 * Normaliza linhas do relatório de cautelados (CSV ou tabelas DOCX).
 */

import { isWeaponCategoryName } from "./category-match.mjs"

const CAUTELADO_RE = /^CAUTELAD/i

export function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "")
}

/** Matrícula: todos os dígitos do RG (legado import_permanentes). */
export function registrationFromRg(rgRaw) {
  const d = digitsOnly(rgRaw)
  return d || null
}

/** RG no banco: primeiros 5 dígitos (createPerson). */
export function rgFromRaw(rgRaw) {
  const d = digitsOnly(rgRaw)
  return d ? d.slice(0, 5) : null
}

export function normalizeSerial(serial) {
  const s = String(serial ?? "").trim()
  if (!s) return null
  const stripped = s.replace(/^0+/, "") || "0"
  return { raw: s, stripped, padded3: stripped.padStart(3, "0") }
}

export function serialVariants(serial) {
  const n = normalizeSerial(serial)
  if (!n) return []
  const set = new Set([n.raw, n.stripped, n.padded3])
  const compact = String(serial ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/-/g, "")
  if (compact) {
    set.add(compact)
    set.add(compact.replace(/[A-Za-z]+$/i, ""))
  }
  const lead = String(serial ?? "").match(/(\d[\d\s.-]*\d|\d+)/)
  if (lead) {
    const d = digitsOnly(lead[0])
    if (d) {
      set.add(d)
      set.add(d.replace(/^0+/, "") || "0")
      if (d.length <= 6) {
        set.add(d.padStart(3, "0"))
        set.add(d.padStart(4, "0"))
        set.add(d.padStart(5, "0"))
      }
    }
  }
  if (/^\d+$/.test(n.stripped)) {
    set.add(n.stripped.padStart(4, "0"))
    set.add(n.stripped.padStart(5, "0"))
  }
  return [...set].filter((x) => x && x.length > 0)
}

export function shouldImportRow(situacao) {
  const s = String(situacao ?? "").trim().toUpperCase()
  if (!s) return false
  return CAUTELADO_RE.test(s)
}

export function parseCsvLine(line) {
  const cols = []
  let cur = ""
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQ = !inQ
      continue
    }
    if (c === "," && !inQ) {
      cols.push(cur.trim())
      cur = ""
      continue
    }
    cur += c
  }
  cols.push(cur.trim())
  return cols
}

/** Linhas de tabela DOCX (sem coluna categoria por linha): Nº, Grad., RG, Nome, Serial, Carr., Destino, Data, Situação */
export function rowFromDocxColumns(cols, lineNo, sectionCategory = "Geral") {
  if (cols.length >= 9 && /^\d+$/.test(String(cols[0]).trim())) {
    return rowFromColumns(
      [
        sectionCategory,
        cols[1],
        cols[2],
        cols[3],
        cols[4],
        cols[5],
        "",
        cols[6],
        cols[7],
        cols[8],
      ],
      lineNo
    )
  }
  return rowFromColumns(cols, lineNo)
}

export function rowFromColumns(cols, lineNo) {
  if (cols.length < 6) return { skip: true, reason: "colunas_insuficientes", lineNo }

  const categoria = cols[0] ?? ""
  const patente = cols[1] ?? ""
  const rgRaw = cols[2] ?? ""
  const nome = cols[3] ?? ""
  const serial = cols[4] ?? ""
  const carregadores = cols[5] ?? ""
  const tamanho = cols[6] ?? ""
  const destino = cols[7] ?? ""
  const data = cols[8] ?? ""
  const situacao = cols[9] ?? ""

  const nomeUp = nome.toUpperCase()
  if (!nome || nomeUp.includes("NOME") || categoria.toUpperCase().includes("CATEGORIA")) {
    return { skip: true, reason: "cabecalho", lineNo }
  }
  if (categoria.toUpperCase().includes("PALMAS") && !serial) {
    return { skip: true, reason: "rodape", lineNo }
  }

  const registration_number = registrationFromRg(rgRaw)
  const rg = rgFromRaw(rgRaw)
  if (!registration_number || !rg) {
    return { skip: true, reason: "rg_invalido", lineNo, rgRaw, nome }
  }

  if (!shouldImportRow(situacao)) {
    return { skip: true, reason: "situacao_nao_cautelado", lineNo, situacao, nome, serial }
  }

  const isWeapon = isWeaponCategoryName(categoria)
  const chargerParsed = parseInt(String(carregadores).trim(), 10)
  const charger_qty =
    isWeapon && Number.isFinite(chargerParsed) ? Math.max(0, chargerParsed) : 0
  const quantity_delivered = 1

  return {
    skip: false,
    lineNo,
    categoria: categoria.trim(),
    patente: patente.trim(),
    rgRaw: rgRaw.trim(),
    registration_number,
    rg,
    full_name: nome.trim().toUpperCase(),
    serial_raw: String(serial).trim(),
    serial_variants: serialVariants(serial),
    quantity: quantity_delivered,
    quantity_delivered,
    charger_qty,
    is_weapon_row: isWeapon,
    tamanho: tamanho.trim() || null,
    destino: destino.trim() || null,
    data: data.trim() || null,
    situacao: situacao.trim(),
  }
}

export function parseCsvContent(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  const rows = []
  const skipped = []
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1
    if (i === 0 && lines[0].toUpperCase().includes("CATEGORIA")) continue
    const cols = parseCsvLine(lines[i])
    const row = rowFromColumns(cols, lineNo)
    if (row.skip) skipped.push(row)
    else rows.push(row)
  }
  return { rows, skipped }
}
