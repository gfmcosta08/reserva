"use client"

import { Trash2 } from "lucide-react"
import { PackQtyInput } from "./PackQtyInput"
import type { MaterialLine } from "./CautelaMaterialsStep"
import { BUCKET_LABEL, BUCKET_ORDER, lineBucket } from "@/lib/cautela-summary-buckets"

const inputNoSpinner =
  "w-16 py-1 px-1 bg-slate-900 border border-slate-700 rounded text-right text-white text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"

type Props = {
  lines: MaterialLine[]
  onQtyChange: (rowId: string, qty: number) => void
  onRemove: (rowId: string) => void
}

/** Resumo visível do que já entrou na cautela (substitui o bloco confuso “N linhas”). */
export function CautelaLinesSummary({ lines, onQtyChange, onRemove }: Props) {
  if (lines.length === 0) return null

  const byBucket = BUCKET_ORDER.map((bucket) => ({
    bucket,
    label: BUCKET_LABEL[bucket],
    rows: lines.filter((row) => lineBucket(row.material.category, row.material.name) === bucket),
  })).filter((g) => g.rows.length > 0)

  return (
    <div className="p-3 bg-emerald-500/5 border border-emerald-500/30 rounded-xl space-y-2">
      <div>
        <p className="text-xs font-semibold text-emerald-400">Resumo — materiais desta cautela</p>
        <p className="text-[10px] text-slate-500 mt-0.5">
          Tudo que você incluiu (pacote pistola, colete, HT, etc.) aparece aqui. Ajuste quantidades ou remova antes de
          continuar.
        </p>
      </div>
      <div className="space-y-3 max-h-44 overflow-y-auto pr-0.5">
        {byBucket.map(({ bucket, label, rows }) => (
          <div key={bucket}>
            <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">{label}</p>
            <div className="space-y-1.5">
              {rows.map((row) => (
                <div
                  key={row.rowId}
                  className="flex items-center gap-2 text-xs bg-slate-950/80 rounded-lg px-2 py-1.5 border border-slate-800"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-slate-200 truncate block">{row.material.name}</span>
                    <span className="text-[10px] text-slate-500">
                      Pat {row.material.patrimony_number}
                      {row.material.category ? ` • ${row.material.category}` : ""}
                      {row.packWeaponLabel ? ` • Pacote: ${row.packWeaponLabel}` : ""}
                      {row.poolMaterialIds && row.poolMaterialIds.length > 1
                        ? ` • ${row.poolMaterialIds.length} unid. do pool`
                        : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[9px] text-slate-600 uppercase">Qtd</span>
                    <PackQtyInput
                      value={row.quantity}
                      onChange={(n) => onQtyChange(row.rowId, Math.max(1, n))}
                      min={1}
                      max={99999}
                      className={inputNoSpinner}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(row.rowId)}
                    className="text-red-400 hover:text-red-300 p-1"
                    title="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
