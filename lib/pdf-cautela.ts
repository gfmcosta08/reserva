/**
 * Server-side PDF generation for Cautela receipts.
 * Uses jspdf + jspdf-autotable.
 * Returns a Buffer suitable for email attachments or HTTP responses.
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface GenerateCautelaPDFParams {
  cautela: {
    id: string
    type: 'daily' | 'permanent'
    status: string
    created_at: string
    notes?: string | null
  }
  person: {
    full_name: string
    rg: string
    registration_number: string
    function?: string | null
  }
  operator: {
    name: string
    email: string
  }
  items: Array<{
    name: string
    patrimony_number: string
    internal_code: string
    category?: string
    quantity_delivered: number
  }>
}

// Blue accent used for headers
const BLUE = [30, 80, 180] as [number, number, number]
const LIGHT_BLUE = [220, 232, 255] as [number, number, number]
const DARK = [30, 30, 30] as [number, number, number]
const GRAY = [100, 100, 100] as [number, number, number]
const WHITE = [255, 255, 255] as [number, number, number]
const LIGHT_GRAY = [245, 245, 245] as [number, number, number]

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString)
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoString
  }
}

function formatDateOnly(isoString: string): string {
  try {
    const d = new Date(isoString)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return isoString
  }
}

export async function generateCautelaPDF(params: GenerateCautelaPDFParams): Promise<Buffer> {
  const { cautela, person, operator, items } = params

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 14
  const contentW = pageW - margin * 2

  let y = margin

  // ── Header bar ──────────────────────────────────────────────────────────────
  doc.setFillColor(...BLUE)
  doc.rect(0, 0, pageW, 22, 'F')

  // Logo box
  doc.setFillColor(...WHITE)
  doc.roundedRect(margin, 4, 28, 14, 2, 2, 'F')
  doc.setTextColor(...BLUE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('RESERVA', margin + 14, 13, { align: 'center' })

  // Title
  doc.setTextColor(...WHITE)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('RECIBO DE CAUTELA DE MATERIAL', pageW / 2, 10, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Sistema RESERVA – Controle de Material', pageW / 2, 16, { align: 'center' })

  y = 28

  // ── Cautela metadata row ─────────────────────────────────────────────────────
  doc.setFillColor(...LIGHT_GRAY)
  doc.rect(margin, y, contentW, 12, 'F')

  doc.setTextColor(...DARK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(`Nº CAUTELA:`, margin + 2, y + 5)
  doc.setFont('helvetica', 'normal')
  doc.text(cautela.id.toUpperCase(), margin + 26, y + 5)

  const typeLabel = cautela.type === 'permanent' ? 'Permanente' : 'Diária'
  doc.setFont('helvetica', 'bold')
  doc.text('TIPO:', margin + 2, y + 10)
  doc.setFont('helvetica', 'normal')
  doc.text(typeLabel, margin + 14, y + 10)

  doc.setFont('helvetica', 'bold')
  doc.text('DATA:', pageW / 2, y + 5)
  doc.setFont('helvetica', 'normal')
  doc.text(formatDate(cautela.created_at), pageW / 2 + 14, y + 5)

  doc.setFont('helvetica', 'bold')
  doc.text('STATUS:', pageW / 2, y + 10)
  doc.setFont('helvetica', 'normal')
  doc.text(cautela.status.toUpperCase(), pageW / 2 + 18, y + 10)

  y += 18

  // ── Dados da Pessoa ──────────────────────────────────────────────────────────
  doc.setFillColor(...BLUE)
  doc.rect(margin, y, contentW, 7, 'F')
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('DADOS DA PESSOA', margin + 3, y + 5)

  y += 7

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: LIGHT_BLUE, textColor: DARK, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { textColor: DARK, fontSize: 8 },
    alternateRowStyles: { fillColor: [250, 250, 255] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 } },
    body: [
      ['Nome Completo', person.full_name],
      ['RG', person.rg],
      ['Matrícula', person.registration_number],
      ['Função', person.function ?? '—'],
    ],
  })

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  // ── Materiais Cautelados ─────────────────────────────────────────────────────
  doc.setFillColor(...BLUE)
  doc.rect(margin, y, contentW, 7, 'F')
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('MATERIAIS CAUTELADOS', margin + 3, y + 5)

  y += 7

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'striped',
    headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { textColor: DARK, fontSize: 8 },
    alternateRowStyles: { fillColor: LIGHT_GRAY },
    columns: [
      { header: 'Material', dataKey: 'name' },
      { header: 'Patrimônio', dataKey: 'patrimony_number' },
      { header: 'Código Interno', dataKey: 'internal_code' },
      { header: 'Categoria', dataKey: 'category' },
      { header: 'Qtd', dataKey: 'quantity_delivered' },
    ],
    body: items.map((item) => ({
      name: item.name,
      patrimony_number: item.patrimony_number,
      internal_code: item.internal_code,
      category: item.category ?? '—',
      quantity_delivered: String(item.quantity_delivered),
    })),
    columnStyles: {
      0: { cellWidth: 'auto' },
      4: { halign: 'center', cellWidth: 14 },
    },
  })

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  // ── Observações ──────────────────────────────────────────────────────────────
  if (cautela.notes) {
    doc.setFillColor(...LIGHT_GRAY)
    doc.rect(margin, y, contentW, 7, 'F')
    doc.setTextColor(...GRAY)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('OBSERVAÇÕES', margin + 3, y + 5)
    y += 9

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...DARK)
    const lines = doc.splitTextToSize(cautela.notes, contentW - 4)
    doc.text(lines, margin + 2, y)
    y += lines.length * 5 + 6
  }

  // ── Signature area ───────────────────────────────────────────────────────────
  const sigY = Math.max(y + 10, pageH - 55)

  doc.setDrawColor(...GRAY)
  doc.setLineWidth(0.3)

  // Left signature — person
  doc.line(margin, sigY + 20, margin + 75, sigY + 20)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY)
  doc.setFontSize(7.5)
  doc.text(person.full_name, margin + 37, sigY + 24, { align: 'center' })
  doc.text('Responsável pelo Material', margin + 37, sigY + 28, { align: 'center' })

  // Right signature — operator
  doc.line(pageW - margin - 75, sigY + 20, pageW - margin, sigY + 20)
  doc.text(operator.name, pageW - margin - 37, sigY + 24, { align: 'center' })
  doc.text('Operador / Responsável', pageW - margin - 37, sigY + 28, { align: 'center' })

  // ── Footer ───────────────────────────────────────────────────────────────────
  const footerY = pageH - 12
  doc.setFillColor(...BLUE)
  doc.rect(0, footerY - 2, pageW, 14, 'F')

  doc.setTextColor(...WHITE)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Operador: ${operator.name} (${operator.email})   |   Gerado em: ${formatDate(new Date().toISOString())}`,
    pageW / 2,
    footerY + 3,
    { align: 'center' },
  )
  doc.text(
    'Este documento é um comprovante digital de custódia de material.',
    pageW / 2,
    footerY + 7,
    { align: 'center' },
  )

  // Watermark-style date stamp on right side metadata area
  doc.setFontSize(6.5)
  doc.setTextColor(...GRAY)
  doc.setFont('helvetica', 'italic')
  doc.text(`Data de emissão: ${formatDateOnly(new Date().toISOString())}`, pageW - margin, margin + 2, { align: 'right' })

  return Buffer.from(doc.output('arraybuffer'))
}
