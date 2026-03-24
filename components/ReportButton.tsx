"use client"

import { useState } from "react"
import { getReportData } from "@/app/actions/report"
import { FileText, Loader2, Download } from "lucide-react"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

export default function ReportButton() {
  const [loading, setLoading] = useState(false)

  const generatePDF = async () => {
    setLoading(true)
    try {
      const data = await getReportData()
      const doc = new jsPDF("portrait", "mm", "a4")
      const pageW = doc.internal.pageSize.getWidth()
      const margin = 14
      let y = 0

      // ===== CABEÇALHO =====
      doc.setFillColor(15, 23, 42) // slate-950
      doc.rect(0, 0, pageW, 42, "F")
      doc.setFillColor(37, 99, 235) // blue-600
      doc.rect(0, 42, pageW, 3, "F")

      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.setFont("helvetica", "bold")
      doc.text("RELATÓRIO DE CONFERÊNCIA DE MATERIAL", margin, 18)

      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      const dateStr = new Date(data.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
      doc.text(`Gerado em: ${dateStr}  |  Operador: ${data.operatorName}`, margin, 28)

      doc.setFontSize(8)
      doc.setTextColor(148, 163, 184) // slate-400
      doc.text(`Total de materiais: ${data.totalMaterials}  |  Disponíveis: ${data.availableMaterials.length}  |  Cautelados: ${data.permanentCautelas.reduce((a: number, c: any) => a + c.items.length, 0) + data.dailyCautelas.reduce((a: number, c: any) => a + c.items.length, 0)}  |  Manutenção: ${data.maintenanceMaterials.length}`, margin, 36)

      y = 52

      // ===== SEÇÃO: CAUTELAS PERMANENTES =====
      if (data.permanentCautelas.length > 0) {
        y = addSectionTitle(doc, "CAUTELAS PERMANENTES", y, margin, [37, 99, 235])

        for (const cautela of data.permanentCautelas) {
          if (y > 260) { doc.addPage(); y = 20 }

          y = addCautelaBlock(doc, cautela, y, margin, pageW)
        }
      }

      // ===== SEÇÃO: CAUTELAS DIÁRIAS =====
      if (data.dailyCautelas.length > 0) {
        if (y > 230) { doc.addPage(); y = 20 }
        y = addSectionTitle(doc, "CAUTELAS DIÁRIAS", y, margin, [245, 158, 11])

        for (const cautela of data.dailyCautelas) {
          if (y > 260) { doc.addPage(); y = 20 }
          y = addCautelaBlock(doc, cautela, y, margin, pageW)
        }
      }

      // ===== SEÇÃO: MATERIAIS DISPONÍVEIS =====
      if (data.availableMaterials.length > 0) {
        if (y > 230) { doc.addPage(); y = 20 }
        y = addSectionTitle(doc, "MATERIAIS DISPONÍVEIS", y, margin, [34, 197, 94])

        const rows = data.availableMaterials.map((m: any, i: number) => [
          i + 1, m.name, m.patrimony_number, m.internal_code, m.serial_number || "—", m.categories?.name || "—"
        ])

        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [["#", "Material", "Patrimônio", "Código", "Série", "Categoria"]],
          body: rows,
          headStyles: { fillColor: [30, 41, 59], textColor: [148, 163, 184], fontSize: 7, fontStyle: "bold" },
          bodyStyles: { fontSize: 7, textColor: [226, 232, 240] },
          alternateRowStyles: { fillColor: [15, 23, 42] },
          styles: { cellPadding: 2 },
        })
        y = (doc as any).lastAutoTable.finalY + 8
      }

      // ===== SEÇÃO: EM MANUTENÇÃO =====
      if (data.maintenanceMaterials.length > 0) {
        if (y > 240) { doc.addPage(); y = 20 }
        y = addSectionTitle(doc, "MATERIAIS EM MANUTENÇÃO", y, margin, [245, 158, 11])

        const rows = data.maintenanceMaterials.map((m: any, i: number) => [
          i + 1, m.name, m.patrimony_number, m.internal_code, m.notes || "—"
        ])

        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [["#", "Material", "Patrimônio", "Código", "Observação"]],
          body: rows,
          headStyles: { fillColor: [30, 41, 59], textColor: [148, 163, 184], fontSize: 7, fontStyle: "bold" },
          bodyStyles: { fontSize: 7, textColor: [226, 232, 240] },
          styles: { cellPadding: 2 },
        })
        y = (doc as any).lastAutoTable.finalY + 8
      }

      // ===== MATERIAIS INDISPONÍVEIS =====
      if (data.unavailableMaterials.length > 0) {
        if (y > 240) { doc.addPage(); y = 20 }
        y = addSectionTitle(doc, "MATERIAIS INDISPONÍVEIS", y, margin, [239, 68, 68])

        const rows = data.unavailableMaterials.map((m: any, i: number) => [
          i + 1, m.name, m.patrimony_number, m.internal_code, m.notes || "—"
        ])

        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [["#", "Material", "Patrimônio", "Código", "Motivo"]],
          body: rows,
          headStyles: { fillColor: [30, 41, 59], textColor: [148, 163, 184], fontSize: 7, fontStyle: "bold" },
          bodyStyles: { fontSize: 7, textColor: [226, 232, 240] },
          styles: { cellPadding: 2 },
        })
      }

      // ===== RODAPÉ EM CADA PÁGINA =====
      const totalPages = (doc as any).internal.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFillColor(15, 23, 42)
        doc.rect(0, 285, pageW, 12, "F")
        doc.setFontSize(7)
        doc.setTextColor(100, 116, 139)
        doc.text("Sistema RESERVA — Controle de Cautela", margin, 291)
        doc.text(`Página ${i} de ${totalPages}`, pageW - margin - 25, 291)
      }

      // Download
      doc.save(`conferencia_material_${new Date().toISOString().slice(0, 10)}.pdf`)

    } catch (err) {
      console.error("Erro ao gerar PDF:", err)
      alert("Erro ao gerar relatório.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={generatePDF}
      disabled={loading}
      className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs disabled:opacity-50 transition-all border border-slate-700 hover:border-slate-600"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
      {loading ? "Gerando..." : "Relatório PDF"}
    </button>
  )
}

// ===== HELPERS =====
function addSectionTitle(doc: jsPDF, title: string, y: number, margin: number, color: number[]): number {
  doc.setFillColor(color[0], color[1], color[2])
  doc.rect(margin, y, 3, 8, "F")
  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(255, 255, 255)
  doc.text(title, margin + 6, y + 6)
  return y + 14
}

function addCautelaBlock(doc: jsPDF, cautela: any, y: number, margin: number, pageW: number): number {
  const person = cautela.persons
  const dateStr = new Date(cautela.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
  const statusLabel = cautela.status === "open" ? "ABERTA" : "PARCIAL"

  // Fundo do bloco
  doc.setFillColor(15, 23, 42)
  doc.roundedRect(margin, y, pageW - margin * 2, 16, 2, 2, "F")

  // Info da pessoa
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(255, 255, 255)
  doc.text(person?.full_name || "—", margin + 4, y + 6)

  doc.setFontSize(7)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(148, 163, 184)
  doc.text(`RG: ${person?.rg || "—"}  |  Mat: ${person?.registration_number || "—"}  |  ${person?.function || ""}`, margin + 4, y + 12)

  // Status e data
  doc.setFontSize(7)
  doc.setFont("helvetica", "bold")
  const statusColor = cautela.status === "open" ? [96, 165, 250] : [250, 204, 21]
  doc.setTextColor(statusColor[0], statusColor[1], statusColor[2])
  doc.text(statusLabel, pageW - margin - 20, y + 6)
  doc.setTextColor(100, 116, 139)
  doc.setFont("helvetica", "normal")
  doc.text(dateStr, pageW - margin - 35, y + 12)

  y += 20

  // Tabela de itens
  if (cautela.items && cautela.items.length > 0) {
    const rows = cautela.items.map((item: any, i: number) => {
      const statusMap: Record<string, string> = { pending: "Pendente", returned: "Devolvido", damaged: "Danificado", missing: "Extraviado" }
      return [
        i + 1,
        item.materials?.name || "—",
        item.materials?.patrimony_number || "—",
        item.materials?.internal_code || "—",
        item.materials?.categories?.name || "—",
        statusMap[item.status] || item.status,
      ]
    })

    autoTable(doc, {
      startY: y,
      margin: { left: margin + 4, right: margin + 4 },
      head: [["#", "Material", "Patrimônio", "Código", "Categoria", "Status"]],
      body: rows,
      headStyles: { fillColor: [30, 41, 59], textColor: [148, 163, 184], fontSize: 6.5, fontStyle: "bold" },
      bodyStyles: { fontSize: 6.5, textColor: [203, 213, 225] },
      alternateRowStyles: { fillColor: [15, 23, 42] },
      styles: { cellPadding: 1.5 },
      didParseCell: (data: any) => {
        if (data.column.index === 5 && data.section === "body") {
          const val = data.cell.raw
          if (val === "Pendente") data.cell.styles.textColor = [250, 204, 21]
          if (val === "Devolvido") data.cell.styles.textColor = [74, 222, 128]
          if (val === "Danificado") data.cell.styles.textColor = [251, 146, 60]
          if (val === "Extraviado") data.cell.styles.textColor = [248, 113, 113]
        }
      },
    })

    y = (doc as any).lastAutoTable.finalY + 6
  }

  if (cautela.notes) {
    doc.setFontSize(6.5)
    doc.setTextColor(100, 116, 139)
    doc.text(`Obs: ${cautela.notes}`, margin + 4, y)
    y += 6
  }

  return y + 4
}
