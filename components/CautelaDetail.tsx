"use client"

import { useState, useEffect } from "react"
import { getCautelaById, returnItem } from "@/app/actions/cautelas"
import CautelaReturnFlow from "./CautelaReturnFlow"
import RenewalModal from "./RenewalModal"
import {
  X, Package, Check, AlertTriangle, Loader2,
  RotateCcw, Ban, Clock, CheckCircle, User, ArrowRight, RefreshCw
} from "lucide-react"

interface CautelaDetailProps {
  cautelaId: string
  onClose: () => void
  onUpdate: () => void
}

export default function CautelaDetail({ cautelaId, onClose, onUpdate }: CautelaDetailProps) {
  const [cautela, setCautela] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showReturnFlow, setShowReturnFlow] = useState(false)
  const [showRenewal, setShowRenewal] = useState(false)
  const [returning, setReturning] = useState<string | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    loadData()
  }, [cautelaId])

  async function loadData() {
    setLoading(true)
    const result = await getCautelaById(cautelaId)
    if (result.error) {
      setError(result.error)
    } else {
      setCautela(result.cautela)
      setItems(result.items || [])
    }
    setLoading(false)
  }

  const handleReturn = async (itemId: string, status: "returned" | "damaged" | "missing") => {
    setReturning(itemId)
    const result = await returnItem(itemId, status)
    if (result.error) {
      alert(result.error)
    } else {
      await loadData()
      onUpdate()
    }
    setReturning(null)
  }

  const handleReturnFlowComplete = () => {
    setShowReturnFlow(false)
    loadData()
    onUpdate()
  }

  const statusMap: Record<string, { label: string; color: string; icon: any }> = {
    pending: { label: "Pendente", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20", icon: Clock },
    returned: { label: "Devolvido", color: "text-green-400 bg-green-500/10 border-green-500/20", icon: CheckCircle },
    damaged: { label: "Danificado", color: "text-red-400 bg-red-500/10 border-red-500/20", icon: AlertTriangle },
    missing: { label: "Extraviado", color: "text-red-500 bg-red-500/10 border-red-500/20", icon: Ban },
  }

  const cautelaStatusMap: Record<string, { label: string; color: string }> = {
    open: { label: "Aberta", color: "text-blue-400 bg-blue-500/10" },
    partial: { label: "Parcial", color: "text-yellow-400 bg-yellow-500/10" },
    closed: { label: "Fechada", color: "text-green-400 bg-green-500/10" },
    divergent: { label: "Divergente", color: "text-red-400 bg-red-500/10" },
  }

  // Contadores
  const pendingItems = items.filter(i => i.status === "pending")
  const processedItems = items.filter(i => i.status !== "pending")

  if (loading) {
    return (
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-8 max-w-2xl w-full mx-auto flex justify-center">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  if (error || !cautela) {
    return (
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-8 max-w-2xl w-full mx-auto text-center">
        <p className="text-red-400">{error || "Cautela não encontrada"}</p>
        <button onClick={onClose} className="mt-4 text-sm text-slate-400 hover:text-white">Fechar</button>
      </div>
    )
  }

  // Se estiver no fluxo de devolução, mostrar componente de retorno
  if (showReturnFlow && pendingItems.length > 0) {
    return (
      <CautelaReturnFlow
        cautelaId={cautelaId}
        items={items}
        onClose={() => setShowReturnFlow(false)}
        onUpdate={handleReturnFlowComplete}
      />
    )
  }

  const cs = cautelaStatusMap[cautela.status] || cautelaStatusMap.open

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden max-w-2xl w-full mx-auto shadow-2xl max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="px-5 py-3 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-white">Detalhes da Cautela</h2>
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${cs.color}`}>{cs.label}</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white p-1"><X className="h-5 w-5" /></button>
      </div>

      <div className="p-5 space-y-5">
        {/* Info da Pessoa */}
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <User className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">{cautela.persons?.full_name}</p>
              <p className="text-xs text-slate-400">
                RG: {cautela.persons?.rg} • Mat: {cautela.persons?.registration_number}
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <span>Tipo: <span className="text-blue-400">{cautela.type === "daily" ? "Diária" : "Permanente"}</span></span>
            <span>Operador: <span className="text-slate-300">{cautela.profiles?.name || cautela.profiles?.email}</span></span>
          </div>
          <p className="text-[10px] text-slate-600 mt-1">
            Aberta em: {new Date(cautela.created_at).toLocaleString("pt-BR")}
            {cautela.closed_at && <span> • Fechada em: {new Date(cautela.closed_at).toLocaleString("pt-BR")}</span>}
          </p>
          {cautela.notes && <p className="mt-2 text-xs text-slate-400 italic">"{cautela.notes}"</p>}
        </div>

        {/* Actions */}
        {(cautela.status === "open" || cautela.status === "partial") && (
          <button
            onClick={() => setShowRenewal(true)}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-500 rounded-xl font-bold transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Renovar Cautela
          </button>
        )}

        {/* Itens */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Itens ({items.length})
            </p>
            {pendingItems.length > 0 && (
              <button
                onClick={() => setShowReturnFlow(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                Devolver ({pendingItems.length})
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="space-y-2">
            {items.map((item: any) => {
              const s = statusMap[item.status] || statusMap.pending
              const Icon = s.icon
              const isPending = item.status === "pending"
              const isReturning = returning === item.id

              // Calcular pendência se houver
              const qtyDelivered = item.quantity_delivered || 1
              const qtyReturned = item.quantity_returned || 0
              const hasPartialReturn = qtyReturned > 0 && qtyReturned < qtyDelivered

              return (
                <div key={item.id} className={`p-3 rounded-xl border transition-all ${
                  isPending ? "bg-slate-950 border-slate-800" : `bg-slate-950/50 border-slate-800/50`
                }`}>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <Package className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-white">{item.materials?.name}</p>
                        <p className="text-[10px] text-slate-500">
                          Pat: {item.materials?.patrimony_number} • Cód: {item.materials?.internal_code}
                          {item.materials?.category && <span> • {item.materials.category}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border flex items-center gap-1 ${s.color}`}>
                        <Icon className="h-3 w-3" />
                        {s.label}
                      </span>
                      {/* Mostrar quantidade se > 1 */}
                      {(qtyDelivered > 1 || qtyReturned > 0) && (
                        <p className="text-[9px] text-slate-500 mt-1">
                          {qtyReturned}/{qtyDelivered} devolvidos
                          {hasPartialReturn && <span className="text-yellow-400"> (pendência: {qtyDelivered - qtyReturned})</span>}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Ações rápidas para item pendente (via velho fluxo) */}
                  {isPending && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-slate-800/50">
                      <button
                        onClick={() => handleReturn(item.id, "returned")}
                        disabled={isReturning}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-500/10 text-green-400 text-xs font-bold border border-green-500/20 hover:bg-green-500/20 disabled:opacity-50"
                      >
                        {isReturning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        OK
                      </button>
                      <button
                        onClick={() => handleReturn(item.id, "damaged")}
                        disabled={isReturning}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-yellow-500/10 text-yellow-400 text-xs font-bold border border-yellow-500/20 hover:bg-yellow-500/20 disabled:opacity-50"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        Danif.
                      </button>
                      <button
                        onClick={() => handleReturn(item.id, "missing")}
                        disabled={isReturning}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs font-bold border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50"
                      >
                        <Ban className="h-3 w-3" />
                        Extra.
                      </button>
                    </div>
                  )}

                  {item.notes && <p className="mt-2 text-[10px] text-slate-500 italic">Obs: {item.notes}</p>}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Modal de Renovação */}
      {showRenewal && cautela && (
        <RenewalModal
          cautela={cautela}
          onClose={() => setShowRenewal(false)}
          onSuccess={() => {
            loadData()
            onUpdate()
          }}
        />
      )}
    </div>
  )
}
