"use client"

import { useState, useEffect } from "react"
import {
  X, Package, Check, AlertTriangle, Loader2,
  RotateCcw, Ban, Clock, CheckCircle, User,
  AlertCircle, MessageSquare, CheckSquare, Square
} from "lucide-react"
import { processBulkDevolution } from "@/app/actions/cautelas"

interface CautelaReturnFlowProps {
  cautelaId: string
  items: any[]
  onClose: () => void
  onUpdate: () => void
}

type ItemReturnState = {
  id: string
  material_id: string
  material_name: string
  patrimony_number: string
  internal_code: string
  category_name: string
  quantity_delivered: number
  status: "pending" | "returned" | "missing" | "damaged"
  returned_at?: string
  // Novo fluxo
  is_confirmed: boolean      // Tick ✔️ marcado
  quantity_returned: number   // Quantidade devolvida
  notes: string              // Observação
}

export default function CautelaReturnFlow({
  cautelaId,
  items: initialItems,
  onClose,
  onUpdate
}: CautelaReturnFlowProps) {
  // Estado dos itens com novo fluxo
  const [itemStates, setItemStates] = useState<ItemReturnState[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Inicializar estados dos itens
  useEffect(() => {
    const states: ItemReturnState[] = initialItems
      .filter((item: any) => item.status === "pending")
      .map((item: any) => ({
        id: item.id,
        material_id: item.material_id,
        material_name: item.materials?.name || "Material",
        patrimony_number: item.materials?.patrimony_number || "",
        internal_code: item.materials?.internal_code || "",
        category_name: item.materials?.category || "",
        quantity_delivered: item.quantity_delivered || 1,
        status: item.status,
        returned_at: item.returned_at,
        is_confirmed: false,         // NÃO ticado por padrão
        quantity_returned: 0,        // Quantidade zerada
        notes: item.notes || ""
      }))

    setItemStates(states)
    setLoading(false)
  }, [initialItems])

  // Atualizar estado de um item
  const updateItemState = (itemId: string, updates: Partial<ItemReturnState>) => {
    setItemStates(prev => prev.map(item =>
      item.id === itemId ? { ...item, ...updates } : item
    ))
  }

  // Marcar/desmarcar tick de confirmação
  const toggleConfirm = (itemId: string) => {
    const item = itemStates.find(i => i.id === itemId)
    if (!item) return

    if (!item.is_confirmed) {
      // Marcando tick: assume devolução completa
      updateItemState(itemId, {
        is_confirmed: true,
        quantity_returned: item.quantity_delivered,
        status: "returned"
      })
    } else {
      // Desmarcando tick: volta ao estado inicial
      updateItemState(itemId, {
        is_confirmed: false,
        quantity_returned: 0,
        status: "pending"
      })
    }
  }

  // Atualizar quantidade devolvida manualmente
  const handleQuantityChange = (itemId: string, value: string) => {
    const item = itemStates.find(i => i.id === itemId)
    if (!item) return

    const qty = parseInt(value) || 0

    // Validar limites
    if (qty < 0 || qty > item.quantity_delivered) return

    // Determinar status baseado na quantidade
    let newStatus: ItemReturnState["status"] = "pending"
    if (qty === item.quantity_delivered) {
      newStatus = "returned"
    } else if (qty > 0) {
      newStatus = "returned" // Devolução parcial ainda é "returned"
    }

    // Desmarcar tick se quantidade não for completa
    const is_confirmed = qty === item.quantity_delivered

    updateItemState(itemId, {
      quantity_returned: qty,
      status: newStatus,
      is_confirmed
    })
  }

  // Marcar item como danificado
  const markAsDamaged = (itemId: string) => {
    updateItemState(itemId, {
      status: "damaged",
      is_confirmed: true,
      quantity_returned: 0
    })
  }

  // Marcar item como extraviado
  const markAsMissing = (itemId: string) => {
    updateItemState(itemId, {
      status: "missing",
      is_confirmed: true,
      quantity_returned: 0
    })
  }

  // Validar antes de submeter
  const validateReturn = (): string | null => {
    // Verificar se há itens pendentes
    const uncheckedItems = itemStates.filter(item => {
      // Item não processado: sem tick E quantidade = 0
      return !item.is_confirmed && item.quantity_returned === 0
    })

    if (uncheckedItems.length > 0) {
      return `Existem ${uncheckedItems.length} item(ns) que não foram conferidos. Marque como devolvido ou informe a quantidade devolvida.`
    }

    // Verificar devoluções parciais
    const partialReturns = itemStates.filter(item =>
      item.quantity_returned > 0 &&
      item.quantity_returned < item.quantity_delivered
    )

    if (partialReturns.length > 0) {
      // Isso é permitido, apenas informar
      return null
    }

    return null
  }

  // Submeter devolução (usando processBulkDevolution para 1 única chamada)
  const handleSubmit = async () => {
    // Validar
    const validation = validateReturn()
    if (validation) {
      setValidationError(validation)
      return
    }

    setSubmitting(true)
    setValidationError(null)

    try {
      // Preparar dados para devolução em lote
      const itemsToProcess = itemStates
        .filter(item => item.is_confirmed || item.quantity_returned > 0)
        .map(item => ({
          cautelaItemId: item.id,
          confirmed: item.is_confirmed,
          quantityReturned: item.quantity_returned > 0 ? item.quantity_returned : undefined,
          notes: item.notes || undefined
        }))

      // Usar função de devolução em lote (1 chamada em vez de N)
      const result = await processBulkDevolution(cautelaId, itemsToProcess)

      if (!result.success) {
        throw new Error(result.error || "Erro ao processar devolução")
      }

      setSuccessMessage(`Devolução processada com sucesso! (${result.processedCount} item(ns))`)
      setTimeout(() => {
        onUpdate()
        onClose()
      }, 1500)

    } catch (error: any) {
      setValidationError(error.message || "Erro ao processar devolução")
    } finally {
      setSubmitting(false)
    }
  }

  // Calcular resumo
  const summary = {
    total: itemStates.length,
    confirmed: itemStates.filter(i => i.is_confirmed).length,
    pending: itemStates.filter(i => !i.is_confirmed && i.quantity_returned === 0).length,
    partial: itemStates.filter(i => i.quantity_returned > 0 && i.quantity_returned < i.quantity_delivered).length,
    damaged: itemStates.filter(i => i.status === "damaged").length,
    missing: itemStates.filter(i => i.status === "missing").length
  }

  if (loading) {
    return (
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-8 max-w-3xl w-full mx-auto flex justify-center">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  if (itemStates.length === 0) {
    return (
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-8 max-w-3xl w-full mx-auto text-center">
        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
        <p className="text-lg font-bold text-white">Todos os itens já foram devolvidos</p>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700"
        >
          Fechar
        </button>
      </div>
    )
  }

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden max-w-3xl w-full mx-auto shadow-2xl max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="px-5 py-3 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <RotateCcw className="h-5 w-5 text-blue-500" />
          <h2 className="text-lg font-bold text-white">Devolução de Itens</h2>
          <span className="text-xs text-slate-400">({summary.total} item(s))</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Resumo Rápido */}
        <div className="flex gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800">
          <div className="flex-1 text-center">
            <p className="text-lg font-bold text-green-400">{summary.confirmed}</p>
            <p className="text-[10px] text-slate-500 uppercase">Conferidos</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-lg font-bold text-yellow-400">{summary.pending}</p>
            <p className="text-[10px] text-slate-500 uppercase">Pendentes</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-lg font-bold text-orange-400">{summary.partial}</p>
            <p className="text-[10px] text-slate-500 uppercase">Parciais</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-lg font-bold text-red-400">{summary.damaged + summary.missing}</p>
            <p className="text-[10px] text-slate-500 uppercase">Diverg.</p>
          </div>
        </div>

        {/* Instruções */}
        <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
          <p className="text-xs text-blue-400">
            <strong>Como funciona:</strong> Marque ✔️ para devolução completa, ou preencha a quantidade para devolução parcial.
            Itens danificados ou extraviados devem ser marcados com os botões correspondentes.
          </p>
        </div>

        {/* Mensagem de Erro de Validação */}
        {validationError && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{validationError}</p>
          </div>
        )}

        {/* Mensagem de Sucesso */}
        {successMessage && (
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
            <p className="text-sm text-green-400">{successMessage}</p>
          </div>
        )}

        {/* Lista de Itens */}
        <div className="space-y-3">
          {itemStates.map((item, index) => {
            const isProcessed = item.is_confirmed || item.quantity_returned > 0
            const isPartial = item.quantity_returned > 0 && item.quantity_returned < item.quantity_delivered
            const isFull = item.quantity_returned === item.quantity_delivered
            const isDamagedOrMissing = item.status === "damaged" || item.status === "missing"

            return (
              <div
                key={item.id}
                className={`p-4 rounded-xl border transition-all ${
                  isProcessed
                    ? isDamagedOrMissing
                      ? "bg-red-500/5 border-red-500/30"
                      : isPartial
                        ? "bg-yellow-500/5 border-yellow-500/30"
                        : "bg-green-500/5 border-green-500/30"
                    : "bg-slate-950 border-slate-800"
                }`}
              >
                {/* Header do Item */}
                <div className="flex items-start gap-3">
                  {/* Checkbox/Tick */}
                  <button
                    onClick={() => !isDamagedOrMissing && toggleConfirm(item.id)}
                    disabled={isDamagedOrMissing}
                    className={`mt-1 h-6 w-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      item.is_confirmed && !isDamagedOrMissing
                        ? "bg-green-600 border-green-600 text-white"
                        : isDamagedOrMissing
                          ? "bg-red-500/20 border-red-500/30 text-red-500"
                          : "border-slate-700 hover:border-green-500/50"
                    }`}
                  >
                    {item.is_confirmed && !isDamagedOrMissing ? (
                      <Check className="h-4 w-4" />
                    ) : isDamagedOrMissing ? (
                      <Ban className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4 text-slate-600" />
                    )}
                  </button>

                  {/* Info do Material */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-white">{item.material_name}</p>
                      {isDamagedOrMissing && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          item.status === "damaged"
                            ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                            : "bg-red-500/20 text-red-400 border border-red-500/30"
                        }`}>
                          {item.status === "damaged" ? "DANIFICADO" : "EXTRAVIADO"}
                        </span>
                      )}
                      {isPartial && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                          DEVOLUÇÃO PARCIAL
                        </span>
                      )}
                      {isFull && item.is_confirmed && !isDamagedOrMissing && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">
                          DEVOLVIDO COMPLETO
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Pat: {item.patrimony_number} • Cód: {item.internal_code}
                      {item.category_name && ` • ${item.category_name}`}
                    </p>
                  </div>

                  {/* Quantidade Entregue */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-slate-500 uppercase">Entregue</p>
                    <p className="text-lg font-bold text-white">{item.quantity_delivered}</p>
                  </div>
                </div>

                {/* Controles (só mostra se não estiver danificado/extraviado) */}
                {!isDamagedOrMissing && (
                  <div className="mt-3 pt-3 border-t border-slate-800/50 grid grid-cols-2 gap-3">
                    {/* Campo de Quantidade Devolvida */}
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-bold">
                        Qtd. Devolvida
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={item.quantity_delivered}
                        value={item.quantity_returned}
                        onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                        className={`w-full mt-1 px-3 py-2 rounded-lg border text-sm font-medium ${
                          item.quantity_returned === item.quantity_delivered
                            ? "bg-green-500/10 border-green-500/30 text-green-400"
                            : item.quantity_returned > 0
                              ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
                              : "bg-slate-900 border-slate-700 text-white"
                        } focus:outline-none focus:ring-1 focus:ring-blue-500`}
                      />
                      {item.quantity_returned < item.quantity_delivered && item.quantity_returned > 0 && (
                        <p className="text-[9px] text-yellow-400 mt-1">
                          Pendência: {item.quantity_delivered - item.quantity_returned} un.
                        </p>
                      )}
                    </div>

                    {/* Observação */}
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-bold">
                        Observação
                      </label>
                      <input
                        type="text"
                        value={item.notes}
                        onChange={(e) => updateItemState(item.id, { notes: e.target.value })}
                        placeholder="Opcional..."
                        className="w-full mt-1 px-3 py-2 rounded-lg border bg-slate-900 border-slate-700 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}

                {/* Ações Rápidas (Danificado/Extraviado) */}
                {!isDamagedOrMissing && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => markAsDamaged(item.id)}
                      className="flex-1 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-400 text-xs font-bold border border-yellow-500/20 hover:bg-yellow-500/20 flex items-center justify-center gap-1"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      Danificado
                    </button>
                    <button
                      onClick={() => markAsMissing(item.id)}
                      className="flex-1 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-bold border border-red-500/20 hover:bg-red-500/20 flex items-center justify-center gap-1"
                    >
                      <Ban className="h-3 w-3" />
                      Extraviado
                    </button>
                  </div>
                )}

                {/* Observação para Danificado/Extraviado */}
                {isDamagedOrMissing && (
                  <div className="mt-3 pt-3 border-t border-slate-800/50">
                    <label className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      Justificativa (obrigatório)
                    </label>
                    <input
                      type="text"
                      value={item.notes}
                      onChange={(e) => updateItemState(item.id, { notes: e.target.value })}
                      placeholder="Descreva o problema..."
                      className="w-full mt-1 px-3 py-2 rounded-lg border bg-slate-900 border-slate-700 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Ações */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-slate-800 bg-slate-900 text-sm font-bold text-slate-400 hover:text-white hover:border-slate-700"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || validationError !== null}
            className="flex-[2] py-3 rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <CheckSquare className="h-4 w-4" />
                Finalizar Devolução
              </>
            )}
          </button>
        </div>

        {/* Aviso de Bloqueio */}
        {summary.pending > 0 && (
          <p className="text-center text-[10px] text-slate-500">
            <AlertCircle className="h-3 w-3 inline mr-1 text-yellow-500" />
            {summary.pending} item(s) pendente(s) - Todos devem ser conferidos
          </p>
        )}
      </div>
    </div>
  )
}
