"use client"

import { useState, useTransition } from "react"
import {
  Crosshair, Plus, Pencil, Trash2, X, Loader2, AlertTriangle,
  CheckCircle, ChevronDown, ChevronUp
} from "lucide-react"
import { createAmmoBatch, updateAmmoBatch, deleteAmmoBatch, type AmmoBatch } from "@/app/actions/ammo-batches"
import { useRouter } from "next/navigation"

interface AmmoBatchesClientProps {
  initialBatches: AmmoBatch[]
}

function getExpiryStatus(expiryDate: string | null): "expired" | "soon" | "ok" | "none" {
  if (!expiryDate) return "none"
  const expiry = new Date(expiryDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffMs = expiry.getTime() - today.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return "expired"
  if (diffDays <= 30) return "soon"
  return "ok"
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-"
  const [year, month, day] = dateStr.split("-")
  return `${day}/${month}/${year}`
}

type FormData = {
  calibre: string
  marca: string
  quantity_total: string
  lot_number: string
  acquisition_date: string
  expiry_date: string
  notes: string
}

const emptyForm: FormData = {
  calibre: "",
  marca: "",
  quantity_total: "",
  lot_number: "",
  acquisition_date: "",
  expiry_date: "",
  notes: "",
}

export default function AmmoBatchesClient({ initialBatches }: AmmoBatchesClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showModal, setShowModal] = useState(false)
  const [editingBatch, setEditingBatch] = useState<AmmoBatch | null>(null)
  const [formData, setFormData] = useState<FormData>(emptyForm)
  const [formError, setFormError] = useState("")
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState("")
  const [successMsg, setSuccessMsg] = useState("")

  const openCreate = () => {
    setEditingBatch(null)
    setFormData(emptyForm)
    setFormError("")
    setShowModal(true)
  }

  const openEdit = (batch: AmmoBatch) => {
    setEditingBatch(batch)
    setFormData({
      calibre: batch.calibre,
      marca: batch.marca || "",
      quantity_total: String(batch.quantity_total),
      lot_number: batch.lot_number || "",
      acquisition_date: batch.acquisition_date || "",
      expiry_date: batch.expiry_date || "",
      notes: batch.notes || "",
    })
    setFormError("")
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingBatch(null)
    setFormData(emptyForm)
    setFormError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")

    if (!formData.calibre.trim()) {
      setFormError("Calibre é obrigatório")
      return
    }
    const qty = parseInt(formData.quantity_total)
    if (!formData.quantity_total || isNaN(qty) || qty <= 0) {
      setFormError("Quantidade total deve ser um número positivo")
      return
    }

    startTransition(async () => {
      let result
      if (editingBatch) {
        result = await updateAmmoBatch(editingBatch.id, {
          calibre: formData.calibre,
          marca: formData.marca,
          quantity_total: qty,
          lot_number: formData.lot_number,
          acquisition_date: formData.acquisition_date,
          expiry_date: formData.expiry_date,
          notes: formData.notes,
        })
      } else {
        result = await createAmmoBatch({
          calibre: formData.calibre,
          marca: formData.marca || undefined,
          quantity_total: qty,
          lot_number: formData.lot_number || undefined,
          acquisition_date: formData.acquisition_date || undefined,
          expiry_date: formData.expiry_date || undefined,
          notes: formData.notes || undefined,
        })
      }

      if (result && "error" in result && result.error) {
        setFormError(result.error)
      } else {
        setSuccessMsg(editingBatch ? "Lote atualizado com sucesso!" : "Lote criado com sucesso!")
        setTimeout(() => setSuccessMsg(""), 3000)
        closeModal()
        router.refresh()
      }
    })
  }

  const handleDelete = async (id: string) => {
    setDeleteError("")
    startTransition(async () => {
      const result = await deleteAmmoBatch(id)
      if (result && "error" in result && result.error) {
        setDeleteError(result.error)
      } else {
        setDeleteConfirm(null)
        setSuccessMsg("Lote excluído com sucesso!")
        setTimeout(() => setSuccessMsg(""), 3000)
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Crosshair className="h-8 w-8 text-blue-500" />
            Munição — Controle de Lotes
          </h1>
          <p className="text-slate-400 text-sm max-w-2xl">
            Gerencie os lotes de munição do arsenal, incluindo calibres, quantidades, datas de aquisição e validade.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-900/40 transition-all shrink-0"
        >
          <Plus className="h-4 w-4" /> Novo Lote
        </button>
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-green-400">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Table */}
      {initialBatches.length === 0 ? (
        <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-slate-800">
          <Crosshair className="h-12 w-12 text-slate-700 mx-auto mb-4" />
          <p className="text-slate-400">Nenhum lote de munição cadastrado.</p>
          <button
            onClick={openCreate}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl"
          >
            <Plus className="h-4 w-4" /> Cadastrar primeiro lote
          </button>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50">
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Calibre</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Marca</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Nº do Lote</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Total</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 min-w-[140px]">Disponível</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Aquisição</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Validade</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Observações</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {initialBatches.map((batch) => {
                  const expiryStatus = getExpiryStatus(batch.expiry_date)
                  const usedPercent = batch.quantity_total > 0
                    ? Math.round((batch.quantity_available / batch.quantity_total) * 100)
                    : 0
                  const canDelete = batch.quantity_available === batch.quantity_total

                  return (
                    <tr key={batch.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-bold text-white">{batch.calibre}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{batch.marca || <span className="text-slate-600">—</span>}</td>
                      <td className="px-4 py-3 text-slate-400 font-mono text-xs">{batch.lot_number || <span className="text-slate-600">—</span>}</td>
                      <td className="px-4 py-3 text-right text-slate-300 font-medium">{batch.quantity_total.toLocaleString("pt-BR")}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-1 min-w-[120px]">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-300 font-medium">{batch.quantity_available.toLocaleString("pt-BR")}</span>
                            <span className="text-slate-500">{usedPercent}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                usedPercent > 50 ? "bg-blue-500" : usedPercent > 20 ? "bg-amber-500" : "bg-red-500"
                              }`}
                              style={{ width: `${usedPercent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(batch.acquisition_date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-slate-400">{formatDate(batch.expiry_date)}</span>
                          {expiryStatus === "expired" && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/20">
                              Vencido
                            </span>
                          )}
                          {expiryStatus === "soon" && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/20">
                              Próximo do Vencimento
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs max-w-[180px]">
                        <span className="truncate block">{batch.notes || <span className="text-slate-600">—</span>}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(batch)}
                            className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              setDeleteConfirm(batch.id)
                              setDeleteError("")
                            }}
                            disabled={!canDelete}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            title={canDelete ? "Excluir" : "Não é possível excluir: munição já utilizada"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Create / Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 sticky top-0 bg-slate-900">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Crosshair className="h-5 w-5 text-blue-500" />
                {editingBatch ? "Editar Lote" : "Novo Lote de Munição"}
              </h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Calibre <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.calibre}
                    onChange={(e) => setFormData((f) => ({ ...f, calibre: e.target.value }))}
                    placeholder="Ex: 9mm, .40, .380"
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                    required
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Marca
                  </label>
                  <input
                    type="text"
                    value={formData.marca}
                    onChange={(e) => setFormData((f) => ({ ...f, marca: e.target.value }))}
                    placeholder="Ex: CBC, Sellier & Bellot"
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Quantidade Total <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.quantity_total}
                    onChange={(e) => setFormData((f) => ({ ...f, quantity_total: e.target.value }))}
                    placeholder="0"
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                    required
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Nº do Lote
                  </label>
                  <input
                    type="text"
                    value={formData.lot_number}
                    onChange={(e) => setFormData((f) => ({ ...f, lot_number: e.target.value }))}
                    placeholder="Ex: LOT-2024-001"
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Data de Aquisição
                  </label>
                  <input
                    type="date"
                    value={formData.acquisition_date}
                    onChange={(e) => setFormData((f) => ({ ...f, acquisition_date: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Data de Validade
                  </label>
                  <input
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData((f) => ({ ...f, expiry_date: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Observações
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Informações adicionais sobre o lote..."
                    rows={3}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2.5 border border-slate-700 bg-slate-800 text-slate-300 hover:text-white rounded-xl font-bold text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-[2] flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-900/40 transition-all"
                >
                  {isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
                  ) : (
                    editingBatch ? "Atualizar Lote" : "Criar Lote"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <Trash2 className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Excluir Lote</h3>
                <p className="text-xs text-slate-400">Esta ação não pode ser desfeita.</p>
              </div>
            </div>

            {deleteError && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                {deleteError}
              </div>
            )}

            <p className="text-sm text-slate-300">
              Tem certeza que deseja excluir este lote de munição?
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => { setDeleteConfirm(null); setDeleteError("") }}
                className="flex-1 px-4 py-2.5 border border-slate-700 bg-slate-800 text-slate-300 hover:text-white rounded-xl font-bold text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
