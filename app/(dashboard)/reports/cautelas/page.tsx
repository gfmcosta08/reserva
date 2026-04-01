import { createClient } from "@/lib/supabase-server"
import { ClipboardCheck, ArrowLeft } from "lucide-react"
import Link from "next/link"
import CautelasReportClient from "./CautelasReportClient"

export const dynamic = "force-dynamic"

export default async function CautelasReportPage() {
  const supabase = await createClient()

  // Buscar todas as cautelas ativas com detalhes minuciosos
  const { data: openCautelas, error } = await supabase
    .from("cautelas")
    .select(`
      *,
      persons(full_name, rg, function, registration_number),
      profiles(name, email),
      cautela_items(
         id, returned, return_date, status, notes,
         materials(name, patrimony_number, internal_code, categories(name))
      )
    `)
    .in("status", ["open", "partial"])
    .order("created_at", { ascending: false })

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center gap-4 text-slate-400 mb-2">
        <Link href="/" className="hover:text-white transition-colors duration-200 flex items-center gap-1 text-sm font-medium">
          <ArrowLeft className="h-4 w-4" /> Voltar ao Dashboard
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-6 border-b border-slate-800">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <ClipboardCheck className="h-8 w-8 text-green-500" />
            Relatório de Cautelas Ativas
          </h1>
          <p className="text-slate-400 max-w-2xl text-sm">
            Listagem detalhada de todos os empréstimos em andamento no arsenal, incluindo minúcias sobre os operadores, armamentos e recebedores.
          </p>
        </div>
      </div>

      {(!openCautelas || openCautelas.length === 0) ? (
        <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-slate-800">
          <ClipboardCheck className="h-12 w-12 text-slate-700 mx-auto mb-4" />
          <p className="text-slate-400">Nenhuma cautela ativa no momento.</p>
        </div>
      ) : (
        <CautelasReportClient cautelas={openCautelas} />
      )}
    </div>
  )
}
