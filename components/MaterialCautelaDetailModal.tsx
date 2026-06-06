"use client"

import { useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Clock, ExternalLink, Package, User, X } from "lucide-react"
import type { MaterialActiveDetail } from "@/lib/material-active-detail"

const CAUTELA_TYPE_LABELS: Record<string, string> = {
  daily: "Diária",
  permanent: "Permanente",
}

type MaterialSummary = {
  id: string
  name: string
  patrimony_number?: string
  internal_code?: string
  category?: string
}

export default function MaterialCautelaDetailModal({
  material,
  activeDetail,
  onClose,
}: {
  material: MaterialSummary
  activeDetail: MaterialActiveDetail
  onClose: () => void
}) {
  const typeLabel = CAUTELA_TYPE_LABELS[activeDetail.cautelaType] || activeDetail.cautelaType

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="material-cautela-detail-title"
      onClick={onClose}
    >
      <div
        className="flex flex-col w-full sm:max-w-lg max-h-[min(92dvh,640px)] bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-slate-800">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="sm:hidden flex items-center gap-1.5 px-2 py-2 -ml-1 text-slate-400 hover:text-white rounded-lg"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm font-bold">Voltar</span>
            </button>
            <div className="hidden sm:flex p-1.5 bg-blue-600/10 rounded-lg text-blue-500 shrink-0">
              <Package className="h-4 w-4" />
            </div>
            <h3 id="material-cautela-detail-title" className="text-base sm:text-lg font-bold text-white truncate">
              Material em uso
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-white transition-colors shrink-0"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain p-4 sm:p-5 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-4 space-y-1">
            <p className="text-sm font-bold text-white">{material.name}</p>
            <p className="text-[10px] text-slate-500 font-mono">
              Patrimônio: {material.patrimony_number || "—"} • Código: {material.internal_code || "—"}
            </p>
            {material.category && (
              <p className="text-[10px] text-slate-500 capitalize">Categoria: {material.category}</p>
            )}
          </div>

          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <User className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Com quem está</p>
                <p className="text-sm font-bold text-white">{activeDetail.personName}</p>
                {(activeDetail.personRg || activeDetail.personMatricula) && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {activeDetail.personRg && `RG: ${activeDetail.personRg}`}
                    {activeDetail.personRg && activeDetail.personMatricula && " • "}
                    {activeDetail.personMatricula && `Mat.: ${activeDetail.personMatricula}`}
                  </p>
                )}
                {activeDetail.personFunction && (
                  <p className="text-xs text-slate-500 mt-0.5">{activeDetail.personFunction}</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2">
              <User className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Autor da cautela</p>
                <p className="text-sm font-semibold text-slate-200">{activeDetail.operatorName}</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Data e hora</p>
                <p className="text-sm font-semibold text-slate-200">
                  {new Date(activeDetail.cautelaCreatedAt).toLocaleString("pt-BR")}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Tipo: {typeLabel}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 p-4 sm:p-5 border-t border-slate-800 bg-slate-800/30 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-3 sm:py-2 min-h-[44px] bg-slate-800 text-slate-300 rounded-xl font-bold hover:text-white transition-colors"
          >
            Fechar
          </button>
          <Link
            href={`/cautelas?id=${activeDetail.cautelaId}`}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 sm:py-2 min-h-[44px] bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Ver cautela completa
          </Link>
        </div>
      </div>
    </div>
  )
}
