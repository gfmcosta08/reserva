"use client"

import { useState } from "react"
import { FileSpreadsheet, Loader2 } from "lucide-react"

interface ExcelExportButtonProps {
  endpoint: string
  filename: string
  label?: string
}

export default function ExcelExportButton({
  endpoint,
  filename,
  label = "Exportar Excel",
}: ExcelExportButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleDownload = async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch(endpoint)
      if (!response.ok) {
        throw new Error(`Erro ao exportar: ${response.statusText}`)
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err.message || "Erro ao exportar")
      setTimeout(() => setError(""), 4000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        onClick={handleDownload}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-900/30 transition-all"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="h-4 w-4" />
        )}
        {loading ? "Exportando..." : label}
      </button>
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  )
}
