import DivergencesReportClient from "./DivergencesReportClient"
import ExcelExportButton from "@/components/ExcelExportButton"

export const dynamic = "force-dynamic"

export default function DivergencesReportPage() {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExcelExportButton
          endpoint="/api/export/divergencias"
          filename="divergencias.xlsx"
          label="Exportar Excel"
        />
      </div>
      <DivergencesReportClient />
    </div>
  )
}
