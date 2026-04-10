import { createClient } from "@/lib/supabase-server"
import { Package, ArrowLeft, Download } from "lucide-react"
import Link from "next/link"
import MaterialsReportClient from "./MaterialsReportClient"

export const dynamic = "force-dynamic"

export default async function MaterialsReportPage() {
  const supabase = await createClient()

  // 1. Matérias com Categoria
  const { data: materials, error: matErr } = await supabase
    .from("materials")
    .select("*")
    .order("name")

  // 2. Cautelas Abertas e seus Itens
  const { data: openCautelas, error: cautErr } = await supabase
    .from("cautelas")
    .select(`
      id, created_at, type,
      persons(full_name, rg, function),
      profiles(name),
      cautela_items(material_id, returned)
    `)
    .in("status", ["open", "partial"])

  const activeMaterialMap = new Map()
  if (openCautelas) {
    openCautelas.forEach((c: any) => {
      c.cautela_items?.forEach((item: any) => {
        if (!item.returned) {
          activeMaterialMap.set(item.material_id, {
            cautela_id: c.id,
            person: c.persons?.full_name || "Desconhecido",
            rg: c.persons?.rg || "-",
            personFunction: c.persons?.function || "-",
            operator: c.profiles?.name || "Sistema",
            date: c.created_at,
            type: c.type
          })
        }
      })
    })
  }

  // 3. Agrupar por categoria e anexar detalhes da cautela
  const grouped: Record<string, { available: any[], cautelados: any[], other: any[] }> = {}
  
  if (materials) {
    materials.forEach((m: any) => {
      const cat = m.category || "Sem Categoria"
      if (!grouped[cat]) grouped[cat] = { available: [], cautelados: [], other: [] }
      
      const detail = activeMaterialMap.get(m.id)
      const enrichedItem = { ...m, activeDetail: detail }

      if (m.status === "available") grouped[cat].available.push(enrichedItem)
      else if (m.status === "cautelado") grouped[cat].cautelados.push(enrichedItem)
      else grouped[cat].other.push(enrichedItem)
    })
  }

  // Prepara matriz estrita convertida para Client
  const categoriesList = Object.keys(grouped).sort().map(cat => ({
    name: cat,
    stats: {
      total: grouped[cat].available.length + grouped[cat].cautelados.length + grouped[cat].other.length,
      available: grouped[cat].available.length,
      cautelados: grouped[cat].cautelados.length,
      other: grouped[cat].other.length
    },
    items: {
      available: grouped[cat].available,
      cautelados: grouped[cat].cautelados,
      other: grouped[cat].other
    }
  }))

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
            <Package className="h-8 w-8 text-blue-500" />
            Relatório Detalhado de Materiais
          </h1>
          <p className="text-slate-400 max-w-2xl text-sm">
            Visão agrupada por categorias, permitindo fiscalização minuciosa de materiais em reserva e materiais atualmente cautelados.
          </p>
        </div>
      </div>

      {categoriesList.length === 0 ? (
        <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-slate-800">
          <Package className="h-12 w-12 text-slate-700 mx-auto mb-4" />
          <p className="text-slate-400">Nenhum material cadastrado no sistema.</p>
        </div>
      ) : (
        <MaterialsReportClient categoriesList={categoriesList} />
      )}
    </div>
  )
}
