"use client"

import { useState, useEffect } from "react"
import { getPersons, deletePerson } from "@/app/actions/persons"
import PersonRegistrationWizard from "@/components/PersonRegistrationWizard"
import { 
  Users, 
  Search, 
  UserPlus, 
  MoreVertical, 
  Trash2, 
  Edit2,
  AlertCircle,
  ShieldCheck,
  ShieldAlert
} from "lucide-react"

export default function PersonsClient() {
  const [persons, setPersons] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [isWizardOpen, setIsWizardOpen] = useState(false)

  const fetchPersons = async (query?: string) => {
    setLoading(true)
    try {
      const data = await getPersons(query)
      setPersons(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPersons(search)
  }, [search])

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja remover esta pessoa?")) {
      await deletePerson(id)
      fetchPersons(search)
    }
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Users className="h-8 w-8 text-blue-500" />
            Gestão de Pessoas
          </h1>
          <p className="text-slate-400 mt-1">Cadastre e gerencie policiais e operadores autorizados.</p>
        </div>
        <button 
          onClick={() => setIsWizardOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500 hover:-translate-y-0.5 transition-all duration-200"
        >
          <UserPlus className="h-5 w-5" />
          Novo Cadastro
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
        </div>
        <input
          type="text"
          placeholder="Buscar por RG, Nome ou Matrícula..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="block w-full rounded-2xl border border-slate-800 bg-slate-900/50 py-4 pl-12 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 backdrop-blur-sm transition-all shadow-xl"
        />
      </div>

      {/* Persons List */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/30">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Identificação</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">RG / Matrícula</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Posto/Graduação</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status PIN</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    Carregando...
                  </td>
                </tr>
              ) : persons.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <AlertCircle className="h-10 w-10 text-slate-700" />
                      <p className="text-slate-500 font-medium">Nenhuma pessoa encontrada com esse critério.</p>
                      <button 
                        onClick={() => setIsWizardOpen(true)}
                        className="text-blue-500 hover:text-blue-400 font-bold text-sm"
                      >
                        Cadastrar agora?
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                persons.map((person) => (
                  <tr key={person.id} className="group hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-400">
                          {person.full_name[0].toUpperCase()}
                        </div>
                        <div>
                          <span className="font-semibold text-white block">{person.full_name}</span>
                          <span className="text-xs text-slate-500">{person.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-slate-300">RG: {person.rg}</p>
                        <p className="text-xs text-slate-500">Matrícula: {person.registration_number}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-400 font-medium">{person.function || "-"}</span>
                    </td>
                    <td className="px-6 py-4">
                      {person.failed_pin_attempts >= 5 ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold text-red-500 border border-red-500/20">
                          <ShieldAlert className="h-3 w-3" /> Bloqueado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 text-xs font-bold text-green-500 border border-green-500/20">
                          <ShieldCheck className="h-3 w-3" /> Ativo
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleDelete(person.id)}
                          className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Wizard Modal */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <PersonRegistrationWizard 
            onSuccess={() => {
              setIsWizardOpen(false)
              fetchPersons(search)
            }} 
            onCancel={() => setIsWizardOpen(false)}
            initialData={search.match(/^\d+$/) ? { rg: search } : { name: search }}
          />
        </div>
      )}
    </div>
  )
}
