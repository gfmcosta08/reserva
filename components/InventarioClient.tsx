"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  ClipboardCheck,
  Plus,
  Search,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Lock,
} from "lucide-react"
import {
  criarInventario,
  adicionarItemConferido,
  fecharInventario,
  buscarMaterialPorPatrimonio,
  cancelarInventario,
  type InventarioRow,
  type InventarioDetail,
  type MaterialSearchResult,
} from "@/app/actions/inventario"
import {
  INVENTARIO_ITEM_STATUS_LABELS,
  INVENTARIO_STATUS_LABELS,
  type InventarioItemStatus,
} from "@/lib/inventario"

interface InventarioClientProps {
  inventarios: InventarioRow[]
  selected?: InventarioDetail | null
}

function statusBadge(status: string) {
  if (status === "ABERTO") return "bg-blue-500/10 text-blue-400 border-blue-500/20"
  if (status === "FECHADO") return "bg-green-500/10 text-green-400 border-green-500/20"
  return "bg-slate-500/10 text-slate-400 border-slate-500/20"
}

function itemStatusBadge(status: InventarioItemStatus) {
  if (status === "CONFERIDO") return "bg-green-500/10 text-green-400 border-green-500/20"
  if (status === "DIVERGENTE") return "bg-amber-500/10 text-amber-400 border-amber-500/20"
  return "bg-red-500/10 text-red-400 border-red-500/20"
}

export default function InventarioClient({ inventarios, selected }: InventarioClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [patrimony, setPatrimony] = useState("")
  const [foundMaterial, setFoundMaterial] = useState<MaterialSearchResult | null>(null)
  const [itemObs, setItemObs] = useState("")
  const [searchError, setSearchError] = useState("")
  const [actionError, setActionError] = useState("")
  const [actionMsg, setActionMsg] = useState("")
  const [newObs, setNewObs] = useState("")

  const abertos = inventarios.filter((i) => i.status === "ABERTO")
  const encerrados = inventarios.filter((i) => i.status !== "ABERTO")

  const handleCreate = () => {
    setActionError("")
    startTransition(async () => {
      const res = await criarInventario(newObs || undefined)
      if ("error" in res) {
        setActionError(res.error)
        return
      }
      router.push(`/inventario/${res.id}`)
      router.refresh()
    })
  }

  const handleSearch = () => {
    setSearchError("")
    setFoundMaterial(null)
    startTransition(async () => {
      const res = await buscarMaterialPorPatrimonio(patrimony)
      if ("error" in res) {
        setSearchError(res.error)
        return
      }
      setFoundMaterial(res)
    })
  }

  const handleAddItem = (status: InventarioItemStatus) => {
    if (!selected || !foundMaterial) return
    setActionError("")
    startTransition(async () => {
      const res = await adicionarItemConferido(
        selected.id,
        foundMaterial.id,
        status,
        itemObs || undefined
      )
      if ("error" in res) {
        setActionError(res.error)
        return
      }
      setActionMsg(`Material marcado como ${INVENTARIO_ITEM_STATUS_LABELS[status]}`)
      setPatrimony("")
      setFoundMaterial(null)
      setItemObs("")
      router.refresh()
    })
  }

  const handleClose = () => {
    if (!selected) return
    setActionError("")
    startTransition(async () => {
      const res = await fecharInventario(selected.id)
      if ("error" in res) {
        setActionError(res.error)
        return
      }
      setActionMsg(
        `Inventário fechado: ${res.conferidos} conferidos, ${res.divergentes} divergentes, ${res.nao_encontrados} não encontrados`
      )
      router.refresh()
    })
  }

  const handleCancel = () => {
    if (!selected) return
    if (!confirm("Cancelar este inventário?")) return
    setActionError("")
    startTransition(async () => {
      const res = await cancelarInventario(selected.id)
      if ("error" in res) {
        setActionError(res.error)
        return
      }
      router.push("/inventario")
      router.refresh()
    })
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <ClipboardCheck className="h-8 w-8 text-blue-500" />
            Inventário Físico
          </h1>
          <p className="text-slate-400 mt-2">
            Conferência de materiais por patrimônio na reserva.
          </p>
        </div>
        {!selected && (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Observação (opcional)"
              value={newObs}
              onChange={(e) => setNewObs(e.target.value)}
              className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white"
            />
            <button
              onClick={handleCreate}
              disabled={isPending}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Novo inventário
            </button>
          </div>
        )}
      </div>

      {(actionError || actionMsg) && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            actionError
              ? "bg-red-500/10 border-red-500/20 text-red-400"
              : "bg-green-500/10 border-green-500/20 text-green-400"
          }`}
        >
          {actionError || actionMsg}
        </div>
      )}

      {selected ? (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase text-slate-500 font-bold tracking-widest">Inventário</p>
                <p className="text-white font-mono text-sm mt-1">{selected.id.slice(0, 8)}…</p>
                <p className="text-slate-400 text-sm mt-2">
                  Iniciado em {new Date(selected.started_at).toLocaleString("pt-BR")}
                </p>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${statusBadge(selected.status)}`}>
                {INVENTARIO_STATUS_LABELS[selected.status]}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
                <p className="text-2xl font-bold text-white">{selected.total_itens ?? 0}</p>
                <p className="text-xs text-slate-500 uppercase">Total</p>
              </div>
              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
                <p className="text-2xl font-bold text-green-400">{selected.conferidos ?? 0}</p>
                <p className="text-xs text-slate-500 uppercase">Conferidos</p>
              </div>
              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
                <p className="text-2xl font-bold text-amber-400">{selected.divergentes ?? 0}</p>
                <p className="text-xs text-slate-500 uppercase">Divergentes</p>
              </div>
              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
                <p className="text-2xl font-bold text-red-400">{selected.nao_encontrados ?? 0}</p>
                <p className="text-xs text-slate-500 uppercase">Não encontrados</p>
              </div>
            </div>
          </div>

          {selected.status === "ABERTO" && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Search className="h-5 w-5 text-blue-400" />
                Buscar material
              </h2>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Patrimônio, código interno ou série"
                  value={patrimony}
                  onChange={(e) => setPatrimony(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="flex-1 px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white"
                />
                <button
                  onClick={handleSearch}
                  disabled={isPending || !patrimony.trim()}
                  className="px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl disabled:opacity-50"
                >
                  Buscar
                </button>
              </div>
              {searchError && <p className="text-sm text-red-400">{searchError}</p>}
              {foundMaterial && (
                <div className="bg-slate-950 border border-slate-700 rounded-xl p-4 space-y-3">
                  <div>
                    <p className="font-semibold text-white">{foundMaterial.name}</p>
                    <p className="text-sm text-slate-400 font-mono">
                      Patrimônio: {foundMaterial.patrimony_number ?? "—"} • Status: {foundMaterial.status}
                    </p>
                  </div>
                  <input
                    type="text"
                    placeholder="Observação do item (opcional)"
                    value={itemObs}
                    onChange={(e) => setItemObs(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleAddItem("CONFERIDO")}
                      disabled={isPending}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-green-600/20 text-green-400 border border-green-500/30 rounded-lg text-sm font-semibold hover:bg-green-600/30 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Conferido
                    </button>
                    <button
                      onClick={() => handleAddItem("DIVERGENTE")}
                      disabled={isPending}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-amber-600/20 text-amber-400 border border-amber-500/30 rounded-lg text-sm font-semibold hover:bg-amber-600/30 disabled:opacity-50"
                    >
                      <AlertTriangle className="h-4 w-4" />
                      Divergente
                    </button>
                    <button
                      onClick={() => handleAddItem("NAO_ENCONTRADO")}
                      disabled={isPending}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-red-600/20 text-red-400 border border-red-500/30 rounded-lg text-sm font-semibold hover:bg-red-600/30 disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Não encontrado
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-white">Itens conferidos</h2>
            </div>
            {selected.itens.length === 0 ? (
              <p className="px-6 py-8 text-slate-500 text-sm">Nenhum item conferido ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase text-slate-500 border-b border-slate-800">
                      <th className="px-6 py-3 text-left">Material</th>
                      <th className="px-6 py-3 text-left">Patrimônio</th>
                      <th className="px-6 py-3 text-left">Status</th>
                      <th className="px-6 py-3 text-left">Conferido em</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {selected.itens.map((item) => (
                      <tr key={item.material_id} className="hover:bg-slate-800/30">
                        <td className="px-6 py-4 text-white">{item.materials?.name ?? "—"}</td>
                        <td className="px-6 py-4 font-mono text-slate-400 text-xs">
                          {item.materials?.patrimony_number ?? "—"}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`text-xs font-bold px-2 py-1 rounded-lg border ${itemStatusBadge(item.status)}`}
                          >
                            {INVENTARIO_ITEM_STATUS_LABELS[item.status]}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-400">
                          {new Date(item.conferido_at).toLocaleString("pt-BR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => router.push("/inventario")}
              className="px-4 py-2 text-slate-400 hover:text-white text-sm font-semibold"
            >
              ← Voltar à lista
            </button>
            {selected.status === "ABERTO" && (
              <>
                <button
                  onClick={handleClose}
                  disabled={isPending}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  Fechar inventário
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isPending}
                  className="px-4 py-2 text-red-400 hover:text-red-300 text-sm font-semibold disabled:opacity-50"
                >
                  Cancelar
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <>
          <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Inventários abertos</h2>
              <span className="text-sm font-bold px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {abertos.length}
              </span>
            </div>
            {abertos.length === 0 ? (
              <p className="px-6 py-8 text-slate-500 text-sm">Nenhum inventário aberto. Crie um novo acima.</p>
            ) : (
              <InventarioTable rows={abertos} onOpen={(id) => router.push(`/inventario/${id}`)} />
            )}
          </section>

          <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-white">Histórico</h2>
            </div>
            {encerrados.length === 0 ? (
              <p className="px-6 py-8 text-slate-500 text-sm">Sem inventários encerrados.</p>
            ) : (
              <InventarioTable rows={encerrados} onOpen={(id) => router.push(`/inventario/${id}`)} />
            )}
          </section>
        </>
      )}
    </div>
  )
}

function InventarioTable({
  rows,
  onOpen,
}: {
  rows: InventarioRow[]
  onOpen: (id: string) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs uppercase text-slate-500 border-b border-slate-800">
            <th className="px-6 py-3 text-left">Início</th>
            <th className="px-6 py-3 text-left">Status</th>
            <th className="px-6 py-3 text-left">Itens</th>
            <th className="px-6 py-3 text-left">Ação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {rows.map((inv) => (
            <tr key={inv.id} className="hover:bg-slate-800/30">
              <td className="px-6 py-4 text-slate-300">
                {new Date(inv.started_at).toLocaleString("pt-BR")}
              </td>
              <td className="px-6 py-4">
                <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${statusBadge(inv.status)}`}>
                  {INVENTARIO_STATUS_LABELS[inv.status]}
                </span>
              </td>
              <td className="px-6 py-4 text-slate-400">{inv.total_itens ?? 0}</td>
              <td className="px-6 py-4">
                <button
                  onClick={() => onOpen(inv.id)}
                  className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
                >
                  Abrir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
