"use client"

import { AlertTriangle, Ban, MessageSquare } from "lucide-react"
import { BUCKET_TYPE_BADGE, lineBucket } from "@/lib/cautela-summary-buckets"
export type ReturnMode = "total" | "partial" | "damaged" | "missing" | null

export type ReturnItemState = {
  id: string
  material_name: string
  patrimony_number: string
  serial_number: string
  internal_code: string
  category_name: string
  quantity_delivered: number
  quantity_already_returned: number
  return_mode: ReturnMode
  quantity_returned_total: number
  notes: string
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

type Props = {
  item: ReturnItemState
  cautelaCreatedAt?: string
  onChange: (id: string, patch: Partial<ReturnItemState>) => void
}

export default function CautelaReturnItemCard({ item, cautelaCreatedAt, onChange }: Props) {
  const balance = Math.max(0, item.quantity_delivered - item.quantity_already_returned)
  const bucket = lineBucket(item.category_name, item.material_name)
  const isDamagedOrMissing = item.return_mode === "damaged" || item.return_mode === "missing"

  const totalQty =
    item.return_mode === "total"
      ? item.quantity_delivered
      : item.quantity_returned_total

  const sessionBalance =
    item.return_mode === "total"
      ? 0
      : Math.max(0, item.quantity_delivered - totalQty)

  return (
    <div
      className={`p-4 rounded-xl border transition-all ${
        isDamagedOrMissing
          ? "bg-red-500/5 border-red-500/30"
          : item.return_mode === "partial"
            ? "bg-yellow-500/5 border-yellow-500/30"
            : item.return_mode === "total"
              ? "bg-green-500/5 border-green-500/30"
              : "bg-slate-950 border-slate-800"
      }`}
    >
      <div className="flex justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white">{item.material_name}</p>
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              {BUCKET_TYPE_BADGE[bucket]}
            </span>
          </div>
          <MaterialIdentifiers
            patrimony={item.patrimony_number}
            serial={item.serial_number}
            code={item.internal_code}
            category={item.category_name}
          />
          {cautelaCreatedAt && (
            <p className="text-[10px] text-slate-600 mt-1">
              Cautelado em: {new Date(cautelaCreatedAt).toLocaleString("pt-BR")}
            </p>
          )}
          <p className="text-[10px] text-slate-400 mt-1">
            Entregue: <span className="text-white font-bold">{item.quantity_delivered} un.</span>
            {item.quantity_already_returned > 0 && (
              <span className="text-green-400">
                {" "}
                • Já devolvido: {item.quantity_already_returned} un.
              </span>
            )}
            {balance > 0 && (
              <span className="text-yellow-400"> • Saldo pendente: {balance} un.</span>
            )}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            ["total", "Devolver total"],
            ["partial", "Devolver parcial"],
            ["damaged", "Danificado"],
            ["missing", "Extraviado"],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            data-testid={`devolver-${mode}-btn`}
            onClick={() => {
              if (mode === "total") {
                onChange(item.id, {
                  return_mode: "total",
                  quantity_returned_total: item.quantity_delivered,
                })
              } else if (mode === "partial") {
                onChange(item.id, {
                  return_mode: "partial",
                  quantity_returned_total: Math.max(
                    item.quantity_already_returned,
                    item.quantity_returned_total || item.quantity_already_returned
                  ),
                })
              } else {
                onChange(item.id, {
                  return_mode: mode,
                  quantity_returned_total: item.quantity_already_returned,
                })
              }
            }}
            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
              item.return_mode === mode
                ? mode === "total"
                  ? "bg-green-600/20 text-green-400 border-green-500/40"
                  : mode === "partial"
                    ? "bg-yellow-600/20 text-yellow-400 border-yellow-500/40"
                    : "bg-red-600/20 text-red-400 border-red-500/40"
                : "bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {item.return_mode === "partial" && (
        <div className="mt-3 pt-3 border-t border-slate-800/50">
          <label className="text-[10px] text-slate-500 uppercase font-bold">
            Qtd. devolvida (acumulado, máx. {item.quantity_delivered} un.)
          </label>
          <input
            type="number"
            min={item.quantity_already_returned}
            max={item.quantity_delivered}
            value={item.quantity_returned_total}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10)
              if (Number.isNaN(v)) return
              const clamped = Math.min(
                item.quantity_delivered,
                Math.max(item.quantity_already_returned, v)
              )
              onChange(item.id, { quantity_returned_total: clamped })
            }}
            className="w-full mt-1 px-3 py-2 rounded-lg border bg-slate-900 border-slate-700 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {sessionBalance > 0 && (
            <p className="text-[9px] text-yellow-400 mt-1">
              Ainda em custódia após esta sessão: {sessionBalance} un.
            </p>
          )}
        </div>
      )}

      {item.return_mode === "total" && (
        <p className="text-[10px] text-green-400 mt-2">
          Devolução total: {item.quantity_delivered} un. (quitando o saldo)
        </p>
      )}

      {isDamagedOrMissing && (
        <div className="mt-3 pt-3 border-t border-slate-800/50">
          <label className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
            {item.return_mode === "damaged" ? (
              <AlertTriangle className="h-3 w-3" />
            ) : (
              <Ban className="h-3 w-3" />
            )}
            Justificativa (obrigatório)
          </label>
          <input
            type="text"
            value={item.notes}
            onChange={(e) => onChange(item.id, { notes: e.target.value })}
            placeholder="Descreva o problema..."
            className="w-full mt-1 px-3 py-2 rounded-lg border bg-slate-900 border-slate-700 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}

      {item.return_mode && !isDamagedOrMissing && (
        <div className="mt-3">
          <label className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            Observação (opcional)
          </label>
          <input
            type="text"
            value={item.notes}
            onChange={(e) => onChange(item.id, { notes: e.target.value })}
            placeholder="Opcional..."
            className="w-full mt-1 px-3 py-2 rounded-lg border bg-slate-900 border-slate-700 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}
    </div>
  )
}
