"use client"

import { useState, useEffect, useCallback } from "react"
import { getCautelas } from "@/app/actions/cautelas"
import CautelaWizard from "./CautelaWizard"
import CautelaDetail from "./CautelaDetail"
import {
  ClipboardList, Plus, Search, Clock, CheckCircle, AlertTriangle,
  ChevronRight, User, Package, Filter, X, Loader2
} from "lucide-react"

const STATUS_FILTERS = [
  { value: "", label: "Todas", icon: ClipboardList },
  { value: "open", label: "Abertas", icon: Clock },
  { value: "partial", label: "Parciais", icon: AlertTriangle },
  { value: "closed", label: "Fechadas", icon: CheckCircle },
  { value: "divergent", label: "Divergentes", icon: AlertTriangle },
]

const statusColors: Record<string, string> = {
  open: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  partial: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  closed: "text-green-400 bg-green-500/10 border-green-500/20",
  divergent: "text-red-400 bg-red-500/10 border-red-500/20",
}

const statusLabels: Record<string, string> = {
  open: "Aberta",
  partial: "Parcial",
  closed: "Fechada",
  divergent: "Divergente",
}

export default function CautelasClient() {
  const [cautelas, setCautelas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [showWizard, setShowWizard] = useState(false)
  const [selectedCautelaId, setSelectedCautelaId] = useState<string | null>(null)

  const loadCautelas = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getCautelas({
        status: statusFilter || undefined,
        search: searchQuery || undefined,
      })
      setCautelas(data)
    } catch (err) {
      console.error("Erro ao carregar cautelas:", err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, searchQuery])

  useEffect(() => {
    loadCautelas()
  }, [loadCautelas])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(loadCautelas, 400)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleWizardSuccess = () => {
    setShowWizard(false)
    loadCautelas()
  }

  if (showWizard) {
    return (
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <CautelaWizard onSuccess={handleWizardSuccess} onCancel={() => setShowWizard(false)} />
      </div>
    )
  }

  if (selectedCautelaId) {
    return (
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <CautelaDetail cautelaId={selectedCautelaId} onClose={() => setSelectedCautelaId(null)} onUpdate={loadCautelas} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Cautelas</h1>
          <p className="text-slate-400 mt-1">Gerenciar empréstimos de materiais.</p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-900/40 transition-all hover:scale-105"
        >
          <Plus className="h-5 w-5" />
          Nova Cautela
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${
                statusFilter === f.value
                  ? "bg-blue-600/10 text-blue-400 border-blue-500/30"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white"
              }`}
            >
              <f.icon className="h-3.5 w-3.5" />
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
        </div>
      ) : cautelas.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <ClipboardList className="h-12 w-12 text-slate-700 mx-auto" />
          <p className="text-slate-500 font-medium">Nenhuma cautela encontrada.</p>
          <button onClick={() => setShowWizard(true)} className="text-sm text-blue-400 hover:text-blue-300 font-bold">
            Criar a primeira cautela
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {cautelas.map((cautela: any) => {
            const color = statusColors[cautela.status] || statusColors.open
            const label = statusLabels[cautela.status] || "Aberta"

            const isDelayed = cautela.type === "daily" && 
                              !["closed", "divergent"].includes(cautela.status) && 
                              new Date(cautela.created_at) < new Date(new Date().setHours(0,0,0,0))

            return (
              <button
                key={cautela.id}
                onClick={() => setSelectedCautelaId(cautela.id)}
                className={`w-full text-left p-4 bg-slate-900/50 border rounded-2xl transition-all group ${
                  isDelayed ? "border-red-500/50 hover:bg-slate-900" : "border-slate-800 hover:border-blue-500/30 hover:bg-slate-900"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-slate-800 flex items-center justify-center">
                      <User className="h-5 w-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                        {cautela.persons?.full_name}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        RG: {cautela.persons?.rg} • Mat: {cautela.persons?.registration_number}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isDelayed && (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border text-red-500 bg-red-500/10 border-red-500/20">
                        <AlertTriangle className="h-3 w-3" /> Atrasada
                      </span>
                    )}
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${color}`}>
                      {label}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-700 group-hover:text-blue-500 transition-colors" />
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <span className="flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    {cautela.items_count || 0} ite{(cautela.items_count || 0) === 1 ? "m" : "ns"}
                  </span>
                  {(cautela.items_with_balance ?? cautela.items_pending) > 0 && (
                    <span className="text-yellow-500">
                      {cautela.items_with_balance ?? cautela.items_pending} com saldo
                    </span>
                  )}
                  {cautela.items_returned > 0 && (
                    <span className="text-green-500">{cautela.items_returned} devolvido(s)</span>
                  )}
                  <span>{cautela.type === "daily" ? "Diária" : "Permanente"}</span>
                  <span className="text-slate-600">{new Date(cautela.created_at).toLocaleDateString("pt-BR")}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
