import { createClient } from "@/lib/supabase-server"
import { getPersonCautelaHistory } from "@/app/actions/persons"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowLeft, ClipboardList, Package, CheckCircle2,
  AlertTriangle, Clock, User, Badge, Phone, Mail
} from "lucide-react"

const statusLabel: Record<string, string> = {
  open: "Aberta",
  partial: "Parcial",
  closed: "Encerrada",
  divergent: "Divergente",
}
const statusColor: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  partial: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  closed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  divergent: "bg-red-500/10 text-red-400 border-red-500/20",
}
const typeLabel: Record<string, string> = { daily: "Diária", permanent: "Permanente" }
const itemStatusIcon: Record<string, React.ReactNode> = {
  returned: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />,
  damaged: <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />,
  missing: <AlertTriangle className="h-3.5 w-3.5 text-red-400" />,
  pending: <Clock className="h-3.5 w-3.5 text-slate-400" />,
}

export default async function PersonHistoryPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const { data: person, error } = await supabase
    .from("persons")
    .select("*")
    .eq("id", params.id)
    .single()

  if (error || !person) notFound()

  const { cautelas } = await getPersonCautelaHistory(params.id)

  const totalCautelas = cautelas.length
  const closedCautelas = cautelas.filter((c: any) => c.status === "closed").length
  const divergentCautelas = cautelas.filter((c: any) => c.status === "divergent").length

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        href="/persons"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para Pessoas
      </Link>

      {/* Person card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-6 flex items-start gap-6">
          {person.rg_front_url ? (
            <img
              src={person.rg_front_url}
              alt="Foto RG"
              className="h-20 w-20 rounded-xl object-cover border border-slate-700 flex-shrink-0"
            />
          ) : (
            <div className="h-20 w-20 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0">
              <User className="h-8 w-8 text-slate-600" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-white">{person.full_name}</h1>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${person.status === "active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-slate-500/10 text-slate-400 border-slate-500/20"}`}>
                {person.status === "active" ? "Ativo" : "Inativo"}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-400">
              <span className="flex items-center gap-1.5"><Badge className="h-3.5 w-3.5" /> RG: <strong className="text-slate-200">{person.rg}</strong></span>
              <span className="flex items-center gap-1.5"><ClipboardList className="h-3.5 w-3.5" /> Mat.: <strong className="text-slate-200">{person.registration_number}</strong></span>
              {person.function && <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> {person.function}</span>}
              {person.email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {person.email}</span>}
              {person.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {person.phone}</span>}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="border-t border-slate-800 grid grid-cols-3 divide-x divide-slate-800">
          {[
            { label: "Total de Cautelas", value: totalCautelas, color: "text-white" },
            { label: "Encerradas", value: closedCautelas, color: "text-emerald-400" },
            { label: "Com Divergência", value: divergentCautelas, color: divergentCautelas > 0 ? "text-red-400" : "text-slate-400" },
          ].map((s) => (
            <div key={s.label} className="p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div>
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">
          Histórico de Cautelas
        </h2>

        {cautelas.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
            <ClipboardList className="h-10 w-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Nenhuma cautela registrada para esta pessoa.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cautelas.map((cautela: any) => {
              const items = cautela.cautela_items ?? []
              const returnedCount = items.filter((i: any) => i.status === "returned").length
              const pendingCount = items.filter((i: any) => i.status === "pending").length
              const damagedCount = items.filter((i: any) => i.status === "damaged").length
              const missingCount = items.filter((i: any) => i.status === "missing").length

              return (
                <div key={cautela.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="p-4 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${statusColor[cautela.status] ?? "bg-slate-500/10 text-slate-400 border-slate-500/20"}`}>
                        {statusLabel[cautela.status] ?? cautela.status}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {typeLabel[cautela.type] ?? cautela.type}
                      </span>
                      <span className="text-sm text-slate-300 font-semibold">
                        {new Date(cautela.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>{items.length} {items.length === 1 ? "item" : "itens"}</span>
                      {cautela.profiles?.name && <span>Operador: <span className="text-slate-300">{cautela.profiles.name}</span></span>}
                      <Link href={`/cautelas`} className="text-blue-400 hover:text-blue-300 transition-colors font-semibold">
                        Ver cautela →
                      </Link>
                    </div>
                  </div>

                  {/* Items */}
                  {items.length > 0 && (
                    <div className="border-t border-slate-800 divide-y divide-slate-800/50">
                      {items.map((item: any) => (
                        <div key={item.id} className="px-4 py-2.5 flex items-center gap-3">
                          <span className="flex-shrink-0">{itemStatusIcon[item.status] ?? itemStatusIcon.pending}</span>
                          <span className="flex-1 text-sm text-slate-300">{item.materials?.name}</span>
                          <span className="text-xs text-slate-500">{item.materials?.patrimony_number}</span>
                          {item.quantity_delivered > 1 && (
                            <span className="text-xs text-slate-500">
                              {item.quantity_returned ?? 0}/{item.quantity_delivered}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Summary bar */}
                  {(damagedCount > 0 || missingCount > 0 || returnedCount > 0) && (
                    <div className="border-t border-slate-800 px-4 py-2 flex gap-4 text-xs">
                      {returnedCount > 0 && <span className="text-emerald-400">{returnedCount} devolvido(s)</span>}
                      {pendingCount > 0 && <span className="text-slate-400">{pendingCount} pendente(s)</span>}
                      {damagedCount > 0 && <span className="text-amber-400">{damagedCount} danificado(s)</span>}
                      {missingCount > 0 && <span className="text-red-400">{missingCount} extraviado(s)</span>}
                      {cautela.notes && <span className="text-slate-500 ml-auto truncate">{cautela.notes}</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
