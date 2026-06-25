"use client"

import { useState, useEffect } from "react"
import { getCautelaById, closeCautela } from "@/app/actions/cautelas"
import CautelaReturnFlow from "./CautelaReturnFlow"
import RenewalModal from "./RenewalModal"
import {
  X, Loader2, AlertCircle,
  RotateCcw, User, ArrowRight, RefreshCw, AlertTriangle, CheckCircle
} from "lucide-react"
import { CautelaDetailItemByBucket, type CautelaItemLineBase } from "@/components/cautela/CautelaItemBucketList"
import { formatPendingBucketSummary, hasOnlyWeaponInventory } from "@/lib/cautela-summary-buckets"
import { itemBalance, itemNeedsReturn } from "@/lib/cautela-return-status"

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
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState("")
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

  const handleReturnFlowComplete = () => {
    setShowReturnFlow(false)
    loadData()
    onUpdate()
  }

  const cautelaStatusMap: Record<string, { label: string; color: string }> = {
    open: { label: "Aberta", color: "text-blue-400 bg-blue-500/10" },
    partial: { label: "Parcial", color: "text-yellow-400 bg-yellow-500/10" },
    closed: { label: "Fechada", color: "text-green-400 bg-green-500/10" },
    divergent: { label: "Divergente", color: "text-red-400 bg-red-500/10" },
  }

  const actionableItems = items.filter((i) => itemNeedsReturn(i))

  const itemLines: CautelaItemLineBase[] = items.map((item: any) => ({
    id: item.id,
    material_name: item.materials?.name || "Material",
    patrimony_number: item.materials?.patrimony_number || "—",
    serial_number: item.materials?.serial_number || "—",
    internal_code: item.materials?.internal_code || "—",
    category_name: item.materials?.category || "",
    quantity_delivered: item.quantity_delivered || 1,
    quantity_returned: item.quantity_returned || 0,
    status: item.status,
  }))

  const showLegacyWeaponHint = hasOnlyWeaponInventory(itemLines)
  const balanceSummary = items
    .filter((i) => itemNeedsReturn(i))
    .map((i) => {
      const name = i.materials?.name || "Item"
      const bal = itemBalance(i)
      return `${name} (${bal} un.)`
    })
    .join(", ")

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

  if (showReturnFlow && actionableItems.length > 0) {
    return (
      <CautelaReturnFlow
        cautelaId={cautelaId}
        items={items}
        context={{
          personName: cautela.persons?.full_name || "Cautelado",
          personRg: cautela.persons?.rg,
          personMatricula: cautela.persons?.registration_number,
          cautelaType: cautela.type === "permanent" ? "permanent" : "daily",
          cautelaNotes: cautela.notes,
          cautelaCreatedAt: cautela.created_at,
        }}
        onClose={() => setShowReturnFlow(false)}
        onUpdate={handleReturnFlowComplete}
      />
    )
  }

  const cs = cautelaStatusMap[cautela.status] || cautelaStatusMap.open

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden max-w-2xl w-full mx-auto shadow-2xl max-h-[90vh] overflow-y-auto">
      <div className="px-5 py-3 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-white">Detalhes da Cautela</h2>
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${cs.color}`}>{cs.label}</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white p-1"><X className="h-5 w-5" /></button>
      </div>

      <div className="p-5 space-y-5">
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
          {cautela.notes && <p className="mt-2 text-xs text-slate-400 italic">&quot;{cautela.notes}&quot;</p>}
        </div>

        {cautela.status === "divergent" && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-xs text-red-300">
              Cautela <strong>divergente</strong>: há item(ns) danificado(s) ou extraviado(s). Itens com saldo
              ainda podem ser devolvidos pelo botão abaixo.
            </p>
          </div>
        )}

        {(cautela.status === "open" || cautela.status === "partial") && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowRenewal(true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-500 rounded-xl font-bold transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Renovar
            </button>
            {items.length === 0 && (
              <button
                onClick={() => { setShowCloseConfirm(true); setCloseError("") }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-500 rounded-xl font-bold transition-colors"
              >
                <X className="h-4 w-4" />
                Fechar Cautela
              </button>
            )}
          </div>
        )}

        <div>
          <div className="flex justify-between items-center mb-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Itens ({items.length})
            </p>
            {actionableItems.length > 0 && (
              <button
                onClick={() => setShowReturnFlow(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                Continuar devolução ({actionableItems.length})
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>

          {balanceSummary && (
            <p className="text-xs text-yellow-400/90 mb-2">
              Saldo pendente: {balanceSummary}
            </p>
          )}

          <p className="text-xs text-slate-500 mb-2">
            Resumo: <span className="text-slate-300">{formatPendingBucketSummary(itemLines)}</span>
          </p>

          {showLegacyWeaponHint && (
            <div className="p-3 mb-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <p className="text-xs text-amber-300">
                Só uma arma listada — verifique carregadores/munição no cadastro.
              </p>
            </div>
          )}

          <CautelaDetailItemByBucket
            lines={itemLines}
            renderActions={(line) => {
              const item = items.find((i: any) => i.id === line.id)
              return item?.notes ? (
                <p className="mt-2 text-[10px] text-slate-500 italic">Obs: {item.notes}</p>
              ) : null
            }}
          />
        </div>
      </div>

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

      {/* Confirmação de Fechar Cautela */}
      {showCloseConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowCloseConfirm(false)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm mx-auto p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Fechar Cautela</h3>
                <p className="text-sm text-slate-400">
                  Tem certeza? Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>

            {closeError && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {closeError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowCloseConfirm(false)}
                disabled={closing}
                className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                onClick={async () => {
                  setClosing(true)
                  setCloseError("")
                  const result = await closeCautela(cautelaId)
                  if (result.error) {
                    setCloseError(result.error)
                    setClosing(false)
                  } else {
                    setShowCloseConfirm(false)
                    loadData()
                    onUpdate()
                  }
                }}
                disabled={closing}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white px-4 py-3 rounded-xl font-bold transition-colors"
              >
                {closing ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Fechando...</>
                ) : (
                  <><CheckCircle className="h-4 w-4" /> Sim, Fechar</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
