"use server"

import { createClient } from "@/lib/supabase-server"

export interface OverdueDailyCautela {
  id: string
  person_name: string
  person_rg: string
  created_at: string
  items_count: number
  items_pending: number
}

export interface OpenDivergence {
  id: string
  cautela_id: string
  person_name: string
  material_name: string
  patrimony_number: string | null
  description: string
  created_at: string
}

export interface UpcomingReview {
  id: string
  person_name: string
  review_date: string
  type: string
  items_count: number
}

export interface AlertsData {
  overdueDaily: OverdueDailyCautela[]
  openDivergences: OpenDivergence[]
  upcomingReviews: UpcomingReview[]
}

export async function getAlerts(): Promise<AlertsData> {
  const supabase = await createClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
  thirtyDaysFromNow.setHours(23, 59, 59, 999)

  // 1. Overdue daily cautelas
  const { data: overdueCautelas } = await supabase
    .from("cautelas")
    .select(`
      id,
      created_at,
      persons(full_name, rg)
    `)
    .eq("type", "daily")
    .in("status", ["open", "partial"])
    .lt("created_at", today.toISOString())
    .order("created_at", { ascending: true })

  // Fetch items for overdue cautelas
  let overdueDaily: OverdueDailyCautela[] = []
  if (overdueCautelas && overdueCautelas.length > 0) {
    const cautelaIds = overdueCautelas.map((c) => c.id)
    const { data: items } = await supabase
      .from("cautela_items")
      .select("cautela_id, status")
      .in("cautela_id", cautelaIds)

    overdueDaily = overdueCautelas.map((c) => {
      const cautelaItems = items?.filter((i) => i.cautela_id === c.id) || []
      const pendingItems = cautelaItems.filter((i) => i.status === "pending").length
      const person = Array.isArray(c.persons) ? c.persons[0] : c.persons
      return {
        id: c.id,
        person_name: person?.full_name ?? "Desconhecido",
        person_rg: person?.rg ?? "-",
        created_at: c.created_at,
        items_count: cautelaItems.length,
        items_pending: pendingItems,
      }
    })
  }

  // 2. Open divergences
  const { data: divergencesRaw } = await supabase
    .from("divergences")
    .select(`
      id,
      description,
      created_at,
      cautela_items(
        id,
        cautela_id,
        materials(name, patrimony_number),
        cautelas(
          id,
          persons(full_name)
        )
      )
    `)
    .eq("status", "open")
    .order("created_at", { ascending: false })

  const openDivergences: OpenDivergence[] = (divergencesRaw || []).map((d) => {
    const item = Array.isArray(d.cautela_items) ? d.cautela_items[0] : d.cautela_items
    const material = item ? (Array.isArray(item.materials) ? item.materials[0] : item.materials) : null
    const cautela = item ? (Array.isArray(item.cautelas) ? item.cautelas[0] : item.cautelas) : null
    const person = cautela ? (Array.isArray(cautela.persons) ? cautela.persons[0] : cautela.persons) : null

    return {
      id: d.id,
      cautela_id: item?.cautela_id ?? "",
      person_name: person?.full_name ?? "Desconhecido",
      material_name: material?.name ?? "Material desconhecido",
      patrimony_number: material?.patrimony_number ?? null,
      description: d.description,
      created_at: d.created_at,
    }
  })

  // 3. Upcoming reviews (permanent cautelas with review_date within next 30 days)
  const { data: reviewCautelas } = await supabase
    .from("cautelas")
    .select(`
      id,
      type,
      review_date,
      persons(full_name)
    `)
    .not("review_date", "is", null)
    .lte("review_date", thirtyDaysFromNow.toISOString())
    .gte("review_date", new Date().toISOString())
    .in("status", ["open", "partial"])
    .order("review_date", { ascending: true })

  let upcomingReviews: UpcomingReview[] = []
  if (reviewCautelas && reviewCautelas.length > 0) {
    const reviewIds = reviewCautelas.map((c) => c.id)
    const { data: reviewItems } = await supabase
      .from("cautela_items")
      .select("cautela_id")
      .in("cautela_id", reviewIds)

    upcomingReviews = reviewCautelas.map((c) => {
      const count = reviewItems?.filter((i) => i.cautela_id === c.id).length ?? 0
      const person = Array.isArray(c.persons) ? c.persons[0] : c.persons
      return {
        id: c.id,
        person_name: person?.full_name ?? "Desconhecido",
        review_date: c.review_date!,
        type: c.type,
        items_count: count,
      }
    })
  }

  return {
    overdueDaily,
    openDivergences,
    upcomingReviews,
  }
}
