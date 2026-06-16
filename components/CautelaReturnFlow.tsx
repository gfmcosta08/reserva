"use client"

import { useState, useEffect, useMemo } from "react"
import {
  X,
  AlertTriangle,
  Loader2,
  RotateCcw,
  CheckCircle,
  User,
  AlertCircle,
  CheckSquare,
  ClipboardList,
} from "lucide-react"
import { processBulkDevolution } from "@/app/actions/cautelas"
import {
  BUCKET_LABEL,
  BUCKET_ORDER,
  formatPendingBucketSummary,
  groupByBucket,
  hasOnlyWeaponInventory,
} from "@/lib/cautela-summary-buckets"
import { itemNeedsReturn } from "@/lib/cautela-return-status"
import CautelaReturnItemCard, {
  type ReturnItemState,
  type ReturnMode,
} from "@/components/cautela/CautelaReturnItemCard"

export type CautelaReturnContext = {
  personName: string
  personRg?: string
  personMatricula?: string
  cautelaType: "daily" | "permanent"
  cautelaNotes?: string | null
  cautelaCreatedAt?: string
}

interface CautelaReturnFlowProps {
  cautelaId: string
  items: any[]
  context: CautelaReturnContext
  onClose: () => void
  onUpdate: () => void
}

function materialFieldsFromItem(item: any) {
  const m = item.materials
  return {
    material_name: m?.name || "Material",
    patrimony_number: m?.patrimony_number || "—",
    serial_number: m?.serial_number || "—",
    internal_code: m?.internal_code || "—",
    category_name: m?.category || "",
  }
}

export default function CautelaReturnFlow({
  cautelaId,
  items: initialItems,
  context,
  onClose,
  onUpdate,
}: CautelaReturnFlowProps) {
  const [itemStates, setItemStates] = useState<ReturnItemState[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    const states: ReturnItemState[] = initialItems
      .filter((item: any) => itemNeedsReturn(item))
      .map((item: any) => {
        const fields = materialFieldsFromItem(item)
        const already = item.quantity_returned || 0
        return {
          id: item.id,
          ...fields,
          quantity_delivered: item.quantity_delivered || 1,
          quantity_already_returned: already,
          return_mode: null as ReturnMode,
          quantity_returned_total: already,
          notes: item.notes || "",
        }
      })

    setItemStates(states)
    setLoading(false)
  }, [initialItems])

  const updateItem = (id: string, patch: Partial<ReturnItemState>) => {
    setItemStates((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const validateReturn = (): string | null => {
    for (const item of itemStates) {
      if (!item.return_mode) {
        return `Selecione como devolver: "${item.material_name}"`
      }
      if (
        (item.return_mode === "damaged" || item.return_mode === "missing") &&
        !item.notes.trim()
      ) {
        return `Justificativa obrigatória para "${item.material_name}"`
      }
      if (item.return_mode === "partial") {
        if (item.quantity_returned_total <= item.quantity_already_returned) {
          return `Informe quantidade maior que o já devolvido em "${item.material_name}"`
        }
        if (item.quantity_returned_total > item.quantity_delivered) {
          return `Quantidade inválida em "${item.material_name}"`
        }
      }
    }
    return null
  }

  const handleSubmit = async () => {
    const validation = validateReturn()
    if (validation) {
      setValidationError(validation)
      return
    }

    setSubmitting(true)
    setValidationError(null)

    try {
      const itemsToProcess = itemStates.map((item) => {
        if (item.return_mode === "damaged") {
          return {
            cautelaItemId: item.id,
            disposition: "damaged" as const,
            notes: item.notes,
          }
        }
        if (item.return_mode === "missing") {
          return {
            cautelaItemId: item.id,
            disposition: "missing" as const,
            notes: item.notes,
          }
        }
        if (item.return_mode === "total") {
          return {
            cautelaItemId: item.id,
            confirmed: true,
            notes: item.notes || undefined,
          }
        }
        return {
          cautelaItemId: item.id,
          quantityReturned: item.quantity_returned_total,
          notes: item.notes || undefined,
        }
      })

      const result = await processBulkDevolution(cautelaId, itemsToProcess)

      if (!result.success) {
        throw new Error(result.error || "Erro ao processar devolução")
      }

      setSuccessMessage(`Devolução registrada (${result.processedCount} item(ns)).`)
      setTimeout(() => {
        onUpdate()
        onClose()
      }, 1500)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao processar devolução"
      setValidationError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const conferenceByBucket = groupByBucket(
    itemStates.map((i) => ({
      ...i,
      material_name: i.material_name,
      category_name: i.category_name,
    }))
  )

  const summary = {
    comSaldo: itemStates.length,
    conferidos: itemStates.filter((i) => i.return_mode !== null).length,
    semModo: itemStates.filter((i) => i.return_mode === null).length,
  }

  const allInventoryLines = useMemo(
    () =>
      initialItems.map((item: any) => ({
        ...materialFieldsFromItem(item),
        id: item.id,
        quantity_delivered: item.quantity_delivered || 1,
        quantity_returned: item.quantity_returned || 0,
        status: item.status,
        material_missing: false,
      })),
    [initialItems]
  )

  const showLegacyWeaponHint = hasOnlyWeaponInventory(allInventoryLines)
  const cautelaTypeLabel = context.cautelaType === "daily" ? "Diária" : "Permanente"

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
        <p className="text-lg font-bold text-white">Nenhum item com saldo pendente</p>
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
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden max-w-3xl w-full mx-auto shadow-2xl flex flex-col max-h-[90vh]">
      <div className="px-5 py-3 border-b border-slate-800 flex justify-between items-start gap-3 bg-slate-900 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-blue-500 shrink-0" />
            <h2 className="text-lg font-bold text-white">Devolução de Itens</h2>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <User className="h-4 w-4 text-blue-400 shrink-0" />
            <p className="text-sm font-semibold text-white truncate">{context.personName}</p>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {cautelaTypeLabel}
            </span>
          </div>
          {(context.personRg || context.personMatricula) && (
            <p className="text-[10px] text-slate-500 mt-0.5 ml-6">
              {context.personRg && `RG: ${context.personRg}`}
              {context.personRg && context.personMatricula && " • "}
              {context.personMatricula && `Mat: ${context.personMatricula}`}
            </p>
          )}
          {context.cautelaCreatedAt && (
            <p className="text-[10px] text-slate-600 mt-0.5 ml-6">
              Cautela aberta em: {new Date(context.cautelaCreatedAt).toLocaleString("pt-BR")}
            </p>
          )}
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white p-1 shrink-0">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-4">
        <section>
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="h-4 w-4 text-blue-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Itens cautelados ({itemStates.length} com saldo pendente)
            </h3>
          </div>

          {showLegacyWeaponHint && (
            <div className="p-3 mb-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <p className="text-xs text-amber-300">
                Cautela legada: só uma linha de arma. Verifique carregadores/munição no cadastro.
              </p>
            </div>
          )}

          <p className="text-xs text-slate-500 mb-3">
            Com saldo:{" "}
            <span className="text-slate-300">
              {formatPendingBucketSummary(
                itemStates.map((i) => ({
                  category_name: i.category_name,
                  material_name: i.material_name,
                  status: "pending",
                }))
              )}
            </span>
          </p>

          <div className="space-y-4">
            {BUCKET_ORDER.map((bucket) => {
              const bucketItems = conferenceByBucket[bucket]
              if (bucketItems.length === 0) return null
              return (
                <div key={bucket}>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {BUCKET_LABEL[bucket]} ({bucketItems.length})
                  </p>
                  <div className="space-y-3">
                    {bucketItems.map((row) => {
                      const item = itemStates.find((s) => s.id === row.id)!
                      return (
                        <CautelaReturnItemCard
                          key={item.id}
                          item={item}
                          cautelaCreatedAt={context.cautelaCreatedAt}
                          onChange={updateItem}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {context.cautelaNotes && (
          <p className="text-xs text-slate-500 italic px-1">Obs. cautela: {context.cautelaNotes}</p>
        )}

        <div className="flex gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800 text-center">
          <div className="flex-1">
            <p className="text-lg font-bold text-blue-400">{summary.comSaldo}</p>
            <p className="text-[10px] text-slate-500 uppercase">Com saldo pendente</p>
          </div>
          <div className="flex-1">
            <p className="text-lg font-bold text-green-400">{summary.conferidos}</p>
            <p className="text-[10px] text-slate-500 uppercase">Modo escolhido</p>
          </div>
          <div className="flex-1">
            <p className="text-lg font-bold text-yellow-400">{summary.semModo}</p>
            <p className="text-[10px] text-slate-500 uppercase">Falta escolher</p>
          </div>
        </div>

        <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
          <p className="text-xs text-blue-400">
            <strong>PRD:</strong> escolha <em>Devolver total</em> ou <em>Devolver parcial</em> em cada
            linha. Saldo pendente mantém a cautela em <strong>Parcial</strong> (não Divergente).
            Divergente só para danificado/extraviado.
          </p>
        </div>

        {validationError && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{validationError}</p>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
            <p className="text-sm text-green-400">{successMessage}</p>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-800 bg-slate-900 p-4 space-y-2">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-slate-800 bg-slate-900 text-sm font-bold text-slate-400 hover:text-white hover:border-slate-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            data-testid="finalizar-dev-btn"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-[2] py-3 rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <CheckSquare className="h-4 w-4" />
                Finalizar devolução
              </>
            )}
          </button>
        </div>
        {summary.semModo > 0 && !validationError && (
          <p className="text-center text-[10px] text-slate-500">
            <AlertTriangle className="h-3 w-3 inline mr-1 text-yellow-500" />
            {summary.semModo} item(ns) sem modo de devolução selecionado
          </p>
        )}
      </div>
    </div>
  )
}
