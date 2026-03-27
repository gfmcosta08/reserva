"use server"

import { createClient } from "@/lib/supabase-server"

export interface DivergenceReport {
  id: string
  status: "divergent"
  type: "daily" | "permanent"
  created_at: string
  closed_at: string | null
  notes: string | null
  persons: {
    id: string
    full_name: string
    rg: string
    registration_number: string | null
    function: string | null
  }
  profiles: {
    name: string | null
    email: string
  }
  cautela_items: DivergenceItem[]
  total_items: number
  returned_items: number
  damaged_items: number
  missing_items: number
  partial_items: number
}

export interface DivergenceItem {
  id: string
  status: string
  quantity_delivered: number | null
  quantity_returned: number | null
  notes: string | null
  returned_at: string | null
  materials: {
    id: string
    name: string
    patrimony_number: string | null
    serial_number: string | null
    internal_code: string | null
  }
}

export async function getDivergenceReport(
  filters?: {
    startDate?: string
    endDate?: string
    type?: "daily" | "permanent"
  }
): Promise<DivergenceReport[]> {
  const supabase = await createClient()

  // Buscar cautelas com status divergent
  let query = supabase
    .from("cautelas")
    .select(`
      id,
      status,
      type,
      created_at,
      closed_at,
      notes,
      persons(id, full_name, rg, registration_number, function),
      profiles(name, email)
    `)
    .eq("status", "divergent")
    .order("closed_at", { ascending: false })

  if (filters?.startDate) {
    query = query.gte("closed_at", filters.startDate)
  }
  if (filters?.endDate) {
    query = query.lte("closed_at", filters.endDate)
  }
  if (filters?.type) {
    query = query.eq("type", filters.type)
  }

  const { data: cautelas, error } = await query

  if (error) throw new Error(error.message)
  if (!cautelas || cautelas.length === 0) return []

  // Buscar itens de cada cautela
  const cautelaIds = cautelas.map(c => c.id)
  const { data: items } = await supabase
    .from("cautela_items")
    .select(`
      id,
      cautela_id,
      status,
      quantity_delivered,
      quantity_returned,
      notes,
      returned_at,
      materials(id, name, patrimony_number, serial_number, internal_code)
    `)
    .in("cautela_id", cautelaIds)

  // Montar relatório completo
  return cautelas.map(cautela => {
    const cautelaItems = items?.filter(i => i.cautela_id === cautela.id) || []

    // Classificar itens
    const damagedItems = cautelaItems.filter(i => i.status === "damaged")
    const missingItems = cautelaItems.filter(i => i.status === "missing")
    const partialItems = cautelaItems.filter(i => {
      const delivered = i.quantity_delivered || 1
      const returned = i.quantity_returned || 0
      return returned > 0 && returned < delivered
    })

    return {
      ...cautela,
      cautela_items: cautelaItems,
      total_items: cautelaItems.length,
      returned_items: cautelaItems.filter(i => i.status === "returned").length,
      damaged_items: damagedItems.length,
      missing_items: missingItems.length,
      partial_items: partialItems.length,
    } as DivergenceReport
  })
}

// Estatísticas resumidas
export async function getDivergenceStats() {
  const supabase = await createClient()

  // Total de divergências
  const { count: totalDivergences } = await supabase
    .from("cautelas")
    .select("*", { count: "exact", head: true })
    .eq("status", "divergent")

  // Por tipo de divergência
  const { data: divergenceItems } = await supabase
    .from("cautela_items")
    .select("status, quantity_delivered, quantity_returned")
    .in("status", ["damaged", "missing"])

  const damagedCount = divergenceItems?.filter(i => i.status === "damaged").length || 0
  const missingCount = divergenceItems?.filter(i => i.status === "missing").length || 0

  const partialItems = divergenceItems?.filter(i => {
    const delivered = i.quantity_delivered || 1
    const returned = i.quantity_returned || 0
    return returned > 0 && returned < delivered
  }) || []

  // Divergências por período
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const { count: recentDivergences } = await supabase
    .from("cautelas")
    .select("*", { count: "exact", head: true })
    .eq("status", "divergent")
    .gte("closed_at", thirtyDaysAgo.toISOString())

  return {
    totalDivergences: totalDivergences || 0,
    damagedCount,
    missingCount,
    partialCount: partialItems.length,
    recentDivergences: recentDivergences || 0,
  }
}
