"use client"

import { Download, User, Factory, Clock, Package, StickyNote, ShieldAlert } from "lucide-react"

export default function CautelasReportClient({ cautelas }: { cautelas: any[] }) {

  const exportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,"
    csvContent += "ID Cautela,Status,Tipo,Data Abertura,Pessoa,RG,Unidade,Operador (Armeiro),Qtd Itens,Itens (Patrimonio)\n"

    cautelas.forEach(c => {
      const itemsList = c.cautela_items?.filter((i: any) => !i.returned).map((i: any) => `${i.materials?.name} (${i.materials?.patrimony_number})`).join(" | ") || "Nenhum"
      const dateStr = new Date(c.created_at).toLocaleString('pt-BR')
      const personName = c.persons?.full_name || "Desconhecido"
      const personRg = c.persons?.rg || ""
      const personFunc = c.persons?.function || "Não informada"
      const operatorName = c.profiles?.name || c.profiles?.email || "Sistema"
      
      csvContent += `"${c.id.substring(0,8)}...","${c.status === 'open' ? 'Aberta' : 'Parcial'}","${c.type === 'daily' ? 'Diaria' : 'Permanente'}","${dateStr}","${personName}","${personRg}","${personFunc}","${operatorName}","${c.cautela_items?.length || 0}","${itemsList}"\n`
    })

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `relatorio_cautelas_ativas_${new Date().getTime()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button 
          onClick={exportCSV}
          className="flex items-center gap-2 bg-emerald-600/20 text-emerald-500 hover:bg-emerald-600/30 border border-emerald-500/30 px-4 py-2 rounded-xl text-sm font-bold transition-colors"
        >
          <Download className="h-4 w-4" /> Exportar Relatório CSV
        </button>
      </div>

      <div className="grid gap-6">
        {cautelas.map(c => {
          const isDelayed = c.type === 'daily' && c.status !== 'closed' && new Date(c.created_at).toDateString() !== new Date().toDateString();
          
          return (
            <div key={c.id} className={`bg-slate-900/50 border ${isDelayed ? 'border-red-500/40' : 'border-slate-800'} rounded-2xl p-6 transition-all`}>
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-white tracking-tight">
                      Cautela #{c.id.substring(0, 8)}
                    </h3>
                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${c.status === 'open' ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500'}`}>
                      {c.status === 'open' ? 'Aberta' : 'Parcial'}
                    </span>
                    <span className="text-xs font-medium px-2 py-1 rounded-md bg-slate-800 text-slate-400">
                      {c.type === 'daily' ? 'Diária' : 'Permanente'}
                    </span>
                    {isDelayed && (
                      <span className="text-xs font-bold px-2 py-1 rounded-md bg-red-500/20 text-red-500 flex items-center gap-1">
                        <ShieldAlert className="h-3 w-3" /> Atrasada
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {new Date(c.created_at).toLocaleString('pt-BR')}</span>
                    <span className="flex items-center gap-1.5"><User className="h-4 w-4" /> Op: {c.profiles?.name || 'Sistema'}</span>
                  </div>
                </div>

                <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3 min-w-[250px]">
                  <p className="text-xs text-slate-500 mb-1 font-bold uppercase tracking-wider">Recebedor</p>
                  <p className="font-semibold text-slate-200">{c.persons?.full_name}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    RG: {c.persons?.rg} • {c.persons?.function || 'Sem Unidade'}
                  </p>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Materiais Retirados</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {c.cautela_items?.map((item: any) => (
                    <div key={item.id} className={`p-3 rounded-xl border ${item.returned ? 'bg-slate-800/20 border-slate-800/50 opacity-60' : 'bg-slate-800/60 border-slate-700/80'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-blue-500" />
                          <span className="font-semibold text-sm text-slate-200">{item.materials?.name}</span>
                        </div>
                        {item.returned && <span className="text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded">Devolvido</span>}
                      </div>
                      <div className="text-xs text-slate-400 space-y-1">
                        <p>Patrimônio: <span className="text-slate-300">{item.materials?.patrimony_number}</span></p>
                        <p>Código: <span className="text-slate-300">{item.materials?.internal_code}</span></p>
                      </div>
                      {item.notes && (
                        <div className="mt-3 text-xs text-amber-400/80 bg-amber-500/5 border border-amber-500/10 p-2 rounded-lg flex items-start gap-1">
                          <StickyNote className="h-3 w-3 mt-0.5 flex-shrink-0" /> {item.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
