"use client"

import { useState, useEffect, useCallback } from "react"
import { getAuditLogs } from "@/app/actions/audit"
import {
  History, Search, Filter, ChevronLeft, ChevronRight,
  ClipboardList, User, Package, AlertTriangle,
  CheckCircle, XCircle, RotateCcw, Clock, Loader2
} from "lucide-react"

const ACTION_MAP: Record<string, { label: string; color: string; icon: any }> = {
  cautela_created: { label: "Cautela Criada", color: "text-blue-400 bg-blue-500/10", icon: ClipboardList },
  cautela_closed: { label: "Cautela Fechada", color: "text-green-400 bg-green-500/10", icon: CheckCircle },
  item_returned: { label: "Item Devolvido", color: "text-green-400 bg-green-500/10", icon: RotateCcw },
  item_damaged: { label: "Item Danificado", color: "text-yellow-400 bg-yellow-500/10", icon: AlertTriangle },
  item_missing: { label: "Item Extraviado", color: "text-red-400 bg-red-500/10", icon: XCircle },
  person_created: { label: "Pessoa Cadastrada", color: "text-purple-400 bg-purple-500/10", icon: User },
  person_updated: { label: "Pessoa Atualizada", color: "text-purple-400 bg-purple-500/10", icon: User },
  material_created: { label: "Material Cadastrado", color: "text-cyan-400 bg-cyan-500/10", icon: Package },
  material_updated: { label: "Material Atualizado", color: "text-cyan-400 bg-cyan-500/10", icon: Package },
  material_status_changed: { label: "Status Alterado", color: "text-amber-400 bg-amber-500/10", icon: Package },
  correction_made: { label: "Correção", color: "text-red-400 bg-red-500/10", icon: AlertTriangle },
}

const ENTITY_FILTERS = [
  { value: "", label: "Todos" },
  { value: "cautelas", label: "Cautelas" },
  { value: "cautela_items", label: "Itens" },
  { value: "persons", label: "Pessoas" },
  { value: "materials", label: "Materiais" },
]

export default function HistoryClient() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [entityFilter, setEntityFilter] = useState("")
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 30

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAuditLogs({
        entity: entityFilter || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      })
      setLogs(data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [entityFilter, page])

  useEffect(() => { loadLogs() }, [loadLogs])

  const handleExportCSV = () => {
    if (logs.length === 0) return
    const headers = ["Data/Hora", "Operador", "Ação", "Entidade", "ID Entidade", "Detalhes"]
    const rows = logs.map((log: any) => [
      new Date(log.timestamp).toLocaleString("pt-BR"),
      log.profiles?.name || log.profiles?.email || "—",
      ACTION_MAP[log.action]?.label || log.action,
      log.entity,
      log.entity_id,
      log.after_state ? JSON.stringify(log.after_state) : "—",
    ])
    const csv = [headers, ...rows].map(r => r.map((c: string) => `"${c}"`).join(",")).join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Histórico</h1>
          <p className="text-slate-400 mt-1">Log de auditoria de todas as operações.</p>
        </div>
        <button onClick={handleExportCSV} disabled={logs.length === 0}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs disabled:opacity-50 transition-all border border-slate-700">
          📋 Exportar CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {ENTITY_FILTERS.map(f => (
          <button key={f.value} onClick={() => { setEntityFilter(f.value); setPage(0) }}
            className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${
              entityFilter === f.value
                ? "bg-blue-600/10 text-blue-400 border-blue-500/30"
                : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
            }`}>{f.label}</button>
        ))}
      </div>

      {/* Logs */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 text-blue-500 animate-spin" /></div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <History className="h-12 w-12 text-slate-700 mx-auto" />
          <p className="text-slate-500 font-medium">Nenhum registro encontrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log: any) => {
            const actionInfo = ACTION_MAP[log.action] || { label: log.action, color: "text-slate-400 bg-slate-500/10", icon: Clock }
            const Icon = actionInfo.icon
            return (
              <div key={log.id} className="p-3 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-slate-700 transition-all">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${actionInfo.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${actionInfo.color.split(" ")[0]}`}>{actionInfo.label}</span>
                        <span className="text-[10px] text-slate-600">em {log.entity}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        por <span className="text-slate-300 font-medium">{log.profiles?.name || log.profiles?.email || "Sistema"}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-600 font-mono">{new Date(log.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>
                    <p className="text-[9px] text-slate-700">{new Date(log.timestamp).toLocaleDateString("pt-BR")}</p>
                  </div>
                </div>
                {log.after_state && (
                  <div className="mt-2 ml-11 text-[10px] text-slate-600 font-mono bg-slate-950/50 px-2 py-1 rounded border border-slate-800/50 overflow-x-auto">
                    {JSON.stringify(log.after_state, null, 0)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      <div className="flex justify-center gap-3 pt-2">
        <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
          className="flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-800 text-xs font-bold text-slate-400 disabled:opacity-30 hover:text-white border border-slate-700">
          <ChevronLeft className="h-3 w-3" /> Anterior
        </button>
        <span className="text-xs font-bold text-slate-500 self-center">Página {page + 1}</span>
        <button onClick={() => setPage(page + 1)} disabled={logs.length < PAGE_SIZE}
          className="flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-800 text-xs font-bold text-slate-400 disabled:opacity-30 hover:text-white border border-slate-700">
          Próxima <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
