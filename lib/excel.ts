/**
 * Server-side Excel export utilities using xlsx.
 * Returns Buffer suitable for HTTP responses or email attachments.
 * Also exports a client-side download helper.
 */

import * as XLSX from 'xlsx'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Material {
  id: string
  name: string
  patrimony_number?: string | null
  serial_number?: string | null
  internal_code?: string | null
  category?: string | null
  marca?: string | null
  modelo?: string | null
  calibre?: string | null
  status: string
  notes?: string | null
  observations?: string | null
}

export interface CautelaReport {
  id: string
  type: 'daily' | 'permanent'
  status: string
  created_at: string
  persons?: {
    full_name?: string | null
    rg?: string | null
    registration_number?: string | null
  } | null
  profiles?: {
    name?: string | null
    email?: string | null
  } | null
  cautela_items?: Array<{
    returned?: boolean | null
    materials?: { name?: string | null } | null
  }> | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function translateStatus(status: string): string {
  const map: Record<string, string> = {
    available: 'Disponível',
    cautelado: 'Cautelado',
    maintenance: 'Manutenção',
    unavailable: 'Indisponível',
    open: 'Aberta',
    partial: 'Parcial',
    closed: 'Fechada',
  }
  return map[status] ?? status
}

function translateType(type: string): string {
  return type === 'daily' ? 'Diária' : type === 'permanent' ? 'Permanente' : type
}

function autoColWidths(ws: XLSX.WorkSheet, rows: string[][]): void {
  if (!rows.length) return
  const colCount = rows[0].length
  const widths: number[] = Array(colCount).fill(10)
  for (const row of rows) {
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] ?? '')
      if (cell.length > widths[c]) widths[c] = cell.length
    }
  }
  ws['!cols'] = widths.map(w => ({ wch: Math.min(w + 2, 60) }))
}

function buildSheet(headers: string[], dataRows: (string | number | null | undefined)[][]): XLSX.WorkSheet {
  const allRows = [headers, ...dataRows.map(r => r.map(v => v ?? ''))] as string[][]
  const ws = XLSX.utils.aoa_to_sheet(allRows)

  // Bold the header row
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c })
    if (ws[cellAddr]) {
      ws[cellAddr].s = { font: { bold: true } }
    }
  }

  autoColWidths(ws, allRows)
  return ws
}

// ─── Export Functions ─────────────────────────────────────────────────────────

/**
 * Export materials list to Excel.
 * Returns a Buffer (works server-side via xlsx write).
 */
export function exportMaterialsToExcel(materials: Material[]): Buffer {
  const headers = [
    'Nome',
    'Patrimônio',
    'Número de Série',
    'Código Interno',
    'Categoria',
    'Marca',
    'Modelo',
    'Calibre',
    'Status',
    'Observações',
  ]

  const rows = materials.map(m => [
    m.name ?? '',
    m.patrimony_number ?? '',
    m.serial_number ?? '',
    m.internal_code ?? '',
    m.category ?? '',
    m.marca ?? '',
    m.modelo ?? '',
    m.calibre ?? '',
    translateStatus(m.status),
    m.notes ?? m.observations ?? '',
  ])

  const ws = buildSheet(headers, rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Materiais')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return buf
}

/**
 * Export cautelas report to Excel.
 */
export function exportCautelasToExcel(cautelas: CautelaReport[]): Buffer {
  const headers = [
    'ID',
    'Pessoa',
    'RG',
    'Matrícula',
    'Operador',
    'Tipo',
    'Status',
    'Data Criação',
    'Qtd Itens',
    'Itens Devolvidos',
    'Itens Pendentes',
  ]

  const rows = cautelas.map(c => {
    const totalItems = c.cautela_items?.length ?? 0
    const returnedItems = c.cautela_items?.filter(i => i.returned).length ?? 0
    const pendingItems = totalItems - returnedItems

    return [
      c.id.substring(0, 8),
      c.persons?.full_name ?? '',
      c.persons?.rg ?? '',
      c.persons?.registration_number ?? '',
      c.profiles?.name ?? c.profiles?.email ?? 'Sistema',
      translateType(c.type),
      translateStatus(c.status),
      c.created_at ? new Date(c.created_at).toLocaleString('pt-BR') : '',
      totalItems,
      returnedItems,
      pendingItems,
    ]
  })

  const ws = buildSheet(headers, rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Cautelas')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return buf
}

/**
 * Export divergências report to Excel.
 */
export function exportDivergenciasToExcel(divergencias: any[]): Buffer {
  const headers = [
    'Cautela ID',
    'Pessoa',
    'Material',
    'Patrimônio',
    'Tipo Problema',
    'Descrição',
    'Status',
    'Data',
  ]

  const rows = divergencias.map(d => [
    d.cautela_id ? String(d.cautela_id).substring(0, 8) : d.cautelaId ?? '',
    d.person ?? d.pessoa ?? '',
    d.material ?? d.materialName ?? '',
    d.patrimony_number ?? d.patrimonio ?? '',
    d.problem_type ?? d.tipoproblema ?? d.tipo ?? '',
    d.description ?? d.descricao ?? '',
    translateStatus(d.status ?? ''),
    d.created_at ?? d.date ?? d.data
      ? new Date(d.created_at ?? d.date ?? d.data).toLocaleString('pt-BR')
      : '',
  ])

  const ws = buildSheet(headers, rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Divergências')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return buf
}

/**
 * Client-side helper to trigger a file download from a Buffer or Uint8Array.
 * Must only be called in the browser.
 */
export function downloadExcel(buffer: Buffer | Uint8Array, filename: string): void {
  if (typeof window === 'undefined') return

  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
