"use client"

import type { ReactNode } from "react"
import { Package } from "lucide-react"
import {
  BUCKET_LABEL,
  BUCKET_ORDER,
  BUCKET_TYPE_BADGE,
  groupByBucket,
  lineBucket,
  type SummaryBucket,
} from "@/lib/cautela-summary-buckets"

const ITEM_STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  returned: "Devolvido",
  damaged: "Danificado",
  missing: "Extraviado",
}

export type CautelaItemLineBase = {
  id: string
  material_name: string
  patrimony_number: string
  serial_number: string
  internal_code: string
  category_name: string
  quantity_delivered: number
  quantity_returned?: number
  status?: string
  material_missing?: boolean
}

function MaterialIdentifiers({
  patrimony,
  serial,
  code,
  category,
}: {
  patrimony: string
  serial: string
  code: string
  category: string
}) {
  return (
    <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
      Pat: {patrimony} • SN: {serial} • Cód: {code}
      {category ? ` • ${category}` : ""}
    </p>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "pending"
      ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/30"
      : status === "returned"
        ? "text-green-400 bg-green-500/10 border-green-500/30"
        : "text-red-400 bg-red-500/10 border-red-500/30"
  return (
    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${cls}`}>
      {ITEM_STATUS_LABEL[status] || status}
    </span>
  )
}

function TypeBadge({ bucket }: { bucket: SummaryBucket }) {
  return (
    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
      {BUCKET_TYPE_BADGE[bucket]}
    </span>
  )
}

export function CautelaInventoryByBucket({ lines }: { lines: CautelaItemLineBase[] }) {
  const groups = groupByBucket(lines)

  return (
    <div className="divide-y divide-slate-800/80">
      {BUCKET_ORDER.map((bucket) => {
        const bucketLines = groups[bucket]
        if (bucketLines.length === 0) return null
        return (
          <div key={bucket}>
            <p className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-900/50 border-b border-slate-800/80">
              {BUCKET_LABEL[bucket]} ({bucketLines.length})
            </p>
            {bucketLines.map((line) => (
              <div key={line.id} className="px-4 py-3 flex gap-3">
                <Package className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white">{line.material_name}</p>
                    <TypeBadge bucket={lineBucket(line.category_name, line.material_name)} />
                    {line.status && <StatusBadge status={line.status} />}
                  </div>
                  <MaterialIdentifiers
                    patrimony={line.patrimony_number}
                    serial={line.serial_number}
                    code={line.internal_code}
                    category={line.category_name}
                  />
                  {line.material_missing && (
                    <p className="text-[9px] text-amber-400 mt-1">Cadastro do material indisponível</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-slate-500 uppercase">Entregue</p>
                  <p className="text-base font-bold text-white">{line.quantity_delivered} un.</p>
                  {(line.quantity_returned ?? 0) > 0 && (
                    <p className="text-[9px] text-green-400 mt-0.5">
                      {line.quantity_returned} já devolvido(s)
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

export function CautelaDetailItemByBucket({
  lines,
  renderActions,
}: {
  lines: CautelaItemLineBase[]
  renderActions?: (line: CautelaItemLineBase) => ReactNode
}) {
  const groups = groupByBucket(lines)

  return (
    <div className="space-y-4">
      {BUCKET_ORDER.map((bucket) => {
        const bucketLines = groups[bucket]
        if (bucketLines.length === 0) return null
        return (
          <div key={bucket}>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              {BUCKET_LABEL[bucket]} ({bucketLines.length})
            </p>
            <div className="space-y-2">
              {bucketLines.map((line) => (
                <div
                  key={line.id}
                  className="p-3 rounded-xl border bg-slate-950 border-slate-800"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <Package className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-white">{line.material_name}</p>
                          <TypeBadge bucket={lineBucket(line.category_name, line.material_name)} />
                        </div>
                        <MaterialIdentifiers
                          patrimony={line.patrimony_number}
                          serial={line.serial_number}
                          code={line.internal_code}
                          category={line.category_name}
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                          Entregue: <span className="font-bold text-white">{line.quantity_delivered} un.</span>
                          {(line.quantity_returned ?? 0) > 0 && (
                            <span className="text-green-400">
                              {" "}
                              • Devolvido: {line.quantity_returned} un.
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    {line.status && <StatusBadge status={line.status} />}
                  </div>
                  {renderActions?.(line)}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
