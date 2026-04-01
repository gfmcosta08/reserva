"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Download, Eye, ShieldAlert, Package, Factory, User, Clock, CheckCircle2 } from "lucide-react"

export default function MaterialsReportClient({ categoriesList }: { categoriesList: any[] }) {
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({})

  const toggleCategory = (name: string) => {
    setExpandedCats(prev => ({ ...prev, [name]: !prev[name] }))
  }

  const exportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,"
    csvContent += "Categoria,Nome,Patrimonio,Codigo Interno,Status,Em Cautela (Pessoa),RG,Unidade/Funcao,Operador,Data da Cautela\n"

    categoriesList.forEach(cat => {
      // Available
      cat.items.available.forEach((m: any) => {
        csvContent += `"${cat.name}","${m.name}","${m.patrimony_number}","${m.internal_code}","Disponivel",,,,,\n`
      })
      // Cautelados
      cat.items.cautelados.forEach((m: any) => {
        const d = m.activeDetail || {}
        csvContent += `"${cat.name}","${m.name}","${m.patrimony_number}","${m.internal_code}","Cautelado","${d.person || ''}","${d.rg || ''}","${d.personFunction || ''}","${d.operator || ''}","${d.date ? new Date(d.date).toLocaleString('pt-BR') : ''}"\n`
      })
      // Other
      cat.items.other.forEach((m: any) => {
        csvContent += `"${cat.name}","${m.name}","${m.patrimony_number}","${m.internal_code}","${m.status === 'maintenance' ? 'Manutencao' : 'Indisponivel'}",,,,,\n`
      })
    })

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `relatorio_materiais_${new Date().getTime()}.csv`)
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

      <div className="grid gap-4">
        {categoriesList.map(cat => (
          <div key={cat.name} className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden transition-all duration-300">
            {/* Header / Summary */}
            <div 
              onClick={() => toggleCategory(cat.name)}
              className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-800/50"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Package className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">{cat.name}</h3>
                  <p className="text-xs text-slate-400">Total: {cat.stats.total} itens cadastrados</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 md:gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-bold text-green-500">{cat.stats.available} na Reserva</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <ShieldAlert className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-bold text-amber-500">{cat.stats.cautelados} Cautelados</span>
                </div>
                {cat.stats.other > 0 && (
                  <div className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 text-sm font-bold">
                    {cat.stats.other} Indisponível/Manutenção
                  </div>
                )}
                <div className="ml-2 text-slate-500">
                  {expandedCats[cat.name] ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </div>
              </div>
            </div>

            {/* Minutiae Details (Expanded state) */}
            {expandedCats[cat.name] && (
              <div className="border-t border-slate-800/50 bg-black/20 p-5 space-y-6">
                
                {/* Cautelados Section */}
                {cat.items.cautelados.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-amber-500 flex items-center gap-2 uppercase tracking-wider">
                      <ShieldAlert className="h-4 w-4" /> Detalhamento de Cautelados
                    </h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                      {cat.items.cautelados.map((m: any) => (
                        <div key={m.id} className="bg-slate-800/30 border border-slate-700/50 p-4 rounded-xl space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-bold text-white">{m.name}</p>
                              <p className="text-[10px] text-slate-400 font-mono">Patrimônio: {m.patrimony_number} • Código: {m.internal_code}</p>
                            </div>
                          </div>
                          <div className="bg-amber-500/5 rounded-lg p-3 border border-amber-500/10 space-y-1">
                            <div className="flex items-center gap-2 text-xs text-amber-400/90 font-medium">
                              <User className="h-3.5 w-3.5" /> 
                              {m.activeDetail?.person}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                              <Factory className="h-3 w-3" /> Unidade: {m.activeDetail?.personFunction || 'Não informada'}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                              <Clock className="h-3 w-3" /> Em: {m.activeDetail?.date ? new Date(m.activeDetail.date).toLocaleString('pt-BR') : '-'}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                Liberação por: {m.activeDetail?.operator}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Available Section */}
                {cat.items.available.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-green-500 flex items-center gap-2 uppercase tracking-wider">
                      <CheckCircle2 className="h-4 w-4" /> Em Reserva (Disponíveis)
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {cat.items.available.map((m: any) => (
                        <div key={m.id} className="bg-slate-800/30 border border-slate-700/50 px-3 py-2 rounded-lg text-xs">
                          <span className="font-semibold text-slate-300">{m.name}</span>
                          <span className="text-slate-500 ml-2"># {m.patrimony_number}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
