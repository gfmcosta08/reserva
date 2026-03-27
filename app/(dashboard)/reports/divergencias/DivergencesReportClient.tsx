"use client"

import { useState, useEffect } from "react"
import { getDivergenceReport, getDivergenceStats, type DivergenceReport } from "@/app/actions/divergences"
import DashboardShell from "@/components/DashboardShell"
import { Download, ShieldAlert, AlertTriangle, Package, XCircle, RotateCcw, Calendar, User, Clock, Filter } from "lucide-react"

export default function DivergencesReportClient({ user }: { user: { email: string; role: string } }) {
  const [report, setReport] = useState<DivergenceReport[]>([])
  const [stats, setStats] = useState<{
    totalDivergences: number
    damagedCount: number
    missingCount: number
    partialCount: number
    recentDivergences: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    type: "" as "" | "daily" | "permanent",
    startDate: "",
    endDate: ""
  })

  const loadData = async () => {
    setLoading(true)
    try {
      const [reportData, statsData] = await Promise.all([
        getDivergenceReport({
          type: filters.type || undefined,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined
        }),
        getDivergenceStats()
      ])
      setReport(reportData)
      setStats(statsData)
    } catch (error) {
      console.error("Erro ao carregar relatório:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [filters])

  const exportCSV = () => {
    if (report.length === 0) return

    let csvContent = "data:text/csv;charset=utf-8,"
    csvContent += "ID Cautela,Tipo,Data Abertura,Data Fechamento,Pessoa,RG,Operador,Total Itens,Devolvidos,Danificados,Faltantes,Parciais\n"

    report.forEach(c => {
      const dateOpen = new Date(c.created_at).toLocaleDateString("pt-BR")
      const dateClose = c.closed_at ? new Date(c.closed_at).toLocaleDateString("pt-BR") : "N/A"
      csvContent += `"${c.id.substring(0,8)}...","${c.type === 'daily' ? 'Diaria' : 'Permanente'}","${dateOpen}","${dateClose}","${c.persons?.full_name || ""}","${c.persons?.rg || ""}","${c.profiles?.name || c.profiles?.email || ""}","${c.total_items}","${c.returned_items}","${c.damaged_items}","${c.missing_items}","${c.partial_items}"\n`
    })

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `relatorio_divergencias_${new Date().getTime()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <DashboardShell user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <ShieldAlert className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Relatório de Divergências</h1>
              <p className="text-sm text-slate-400">Materiais danificados, faltantes ou com devolução parcial</p>
            </div>
          </div>
          <button
            onClick={exportCSV}
            disabled={report.length === 0}
            className="flex items-center gap-2 bg-emerald-600/20 text-emerald-500 hover:bg-emerald-600/30 border border-emerald-500/30 px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" /> Exportar CSV
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="h-4 w-4 text-red-500" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Divergências</span>
              </div>
              <p className="text-3xl font-bold text-white">{stats.totalDivergences}</p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-4 w-4 text-orange-500" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Danificados</span>
              </div>
              <p className="text-3xl font-bold text-white">{stats.damagedCount}</p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Faltantes</span>
              </div>
              <p className="text-3xl font-bold text-white">{stats.missingCount}</p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <RotateCcw className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Parciais</span>
              </div>
              <p className="text-3xl font-bold text-white">{stats.partialCount}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-bold text-slate-300">Filtros</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Tipo de Cautela</label>
              <select
                value={filters.type}
                onChange={(e) => setFilters(f => ({ ...f, type: e.target.value as "" | "daily" | "permanent" }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                <option value="daily">Diária</option>
                <option value="permanent">Permanente</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Data Início</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Data Fim</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        )}

        {/* Empty State */}
        {!loading && report.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
              <ShieldAlert className="h-8 w-8 text-slate-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-300 mb-2">Nenhuma divergência encontrada</h3>
            <p className="text-sm text-slate-500">Não há registros de divergências no período selecionado</p>
          </div>
        )}

        {/* Report List */}
        {!loading && report.length > 0 && (
          <div className="space-y-4">
            {report.map((cautela) => (
              <div key={cautela.id} className="bg-slate-900/50 border border-red-500/20 rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-slate-800/50">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-bold text-white">
                          Cautela #{cautela.id.substring(0, 8)}
                        </h3>
                        <span className="text-xs font-bold px-2 py-1 rounded-md bg-red-500/10 text-red-400 border border-red-500/20">
                          Divergente
                        </span>
                        <span className="text-xs font-medium px-2 py-1 rounded-md bg-slate-800 text-slate-400">
                          {cautela.type === "daily" ? "Diária" : "Permanente"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4" />
                          Aberta: {new Date(cautela.created_at).toLocaleString("pt-BR")}
                        </span>
                        {cautela.closed_at && (
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4" />
                            Fechada: {new Date(cautela.closed_at).toLocaleString("pt-BR")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Person Card */}
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3 min-w-[250px]">
                      <p className="text-xs text-slate-500 mb-1 font-bold uppercase tracking-wider">Recebedor</p>
                      <p className="font-semibold text-slate-200">{cautela.persons?.full_name}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        RG: {cautela.persons?.rg} • {cautela.persons?.function || "Sem função"}
                      </p>
                    </div>
                  </div>

                  {/* Summary Badges */}
                  <div className="flex flex-wrap items-center gap-3 mt-4">
                    <div className="flex items-center gap-1.5 text-sm text-slate-300">
                      <Package className="h-4 w-4 text-slate-500" />
                      <span>{cautela.total_items} itens</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-green-400">
                      <RotateCcw className="h-4 w-4" />
                      <span>{cautela.returned_items} devolvidos</span>
                    </div>
                    {cautela.damaged_items > 0 && (
                      <div className="flex items-center gap-1.5 text-sm text-orange-400">
                        <XCircle className="h-4 w-4" />
                        <span>{cautela.damaged_items} danificados</span>
                      </div>
                    )}
                    {cautela.missing_items > 0 && (
                      <div className="flex items-center gap-1.5 text-sm text-red-400">
                        <AlertTriangle className="h-4 w-4" />
                        <span>{cautela.missing_items} faltantes</span>
                      </div>
                    )}
                    {cautela.partial_items > 0 && (
                      <div className="flex items-center gap-1.5 text-sm text-amber-400">
                        <RotateCcw className="h-4 w-4" />
                        <span>{cautela.partial_items} parciais</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div className="p-6">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                    Detalhamento dos Itens
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {cautela.cautela_items?.map((item) => (
                      <div
                        key={item.id}
                        className={`p-4 rounded-xl border ${
                          item.status === "damaged"
                            ? "bg-orange-500/5 border-orange-500/20"
                            : item.status === "missing"
                            ? "bg-red-500/5 border-red-500/20"
                            : item.quantity_returned !== undefined &&
                              item.quantity_returned < (item.quantity_delivered || 1)
                            ? "bg-amber-500/5 border-amber-500/20"
                            : "bg-slate-800/30 border-slate-700/50"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-slate-500" />
                            <span className="font-semibold text-sm text-slate-200">
                              {item.materials?.name}
                            </span>
                          </div>
                          {item.status === "damaged" && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-500/20 text-orange-400">
                              Danificado
                            </span>
                          )}
                          {item.status === "missing" && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                              Faltante
                            </span>
                          )}
                          {item.status === "returned" &&
                            item.quantity_returned !== undefined &&
                            item.quantity_returned < (item.quantity_delivered || 1) && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
                                Parcial
                              </span>
                            )}
                        </div>
                        <div className="text-xs text-slate-400 space-y-1">
                          <p>
                            Patrimônio:{" "}
                            <span className="text-slate-300">{item.materials?.patrimony_number || "N/A"}</span>
                          </p>
                          <p>
                            Entregue: <span className="text-slate-300">{item.quantity_delivered || 1}</span> |
                            Devolvido:{" "}
                            <span className="text-slate-300">{item.quantity_returned ?? 0}</span>
                          </p>
                        </div>
                        {item.notes && (
                          <div className="mt-2 text-xs text-slate-400 bg-slate-800/50 p-2 rounded-lg">
                            {item.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                {cautela.notes && (
                  <div className="px-6 pb-6">
                    <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-3">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Observações
                      </p>
                      <p className="text-sm text-slate-300">{cautela.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
