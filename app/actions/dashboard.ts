"use server"

import { createClient } from "@/lib/supabase-server"

export async function getDashboardStats() {
  const supabase = await createClient()

  // Contagens em paralelo
  const [
    { count: totalMaterials },
    { count: availableMaterials },
    { count: cauteladoMaterials },
    { count: maintenanceMaterials },
    { count: totalPersons },
    { count: openCautelas },
    { count: totalCautelas },
  ] = await Promise.all([
    supabase.from("materials").select("*", { count: "exact", head: true }),
    supabase.from("materials").select("*", { count: "exact", head: true }).eq("status", "available"),
    supabase.from("materials").select("*", { count: "exact", head: true }).eq("status", "cautelado"),
    supabase.from("materials").select("*", { count: "exact", head: true }).eq("status", "maintenance"),
    supabase.from("persons").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("cautelas").select("*", { count: "exact", head: true }).in("status", ["open", "partial"]),
    supabase.from("cautelas").select("*", { count: "exact", head: true }),
  ])

  // Cautelas diárias abertas (vencendo hoje)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const { count: dailyExpiring } = await supabase
    .from("cautelas")
    .select("*", { count: "exact", head: true })
    .eq("type", "daily")
    .in("status", ["open", "partial"])
    .lt("created_at", today.toISOString())

  // Cautelas divergentes
  const { count: divergentCautelas } = await supabase
    .from("cautelas")
    .select("*", { count: "exact", head: true })
    .eq("status", "divergent")

  // Atividades recentes (últimas 10)
  const { data: recentActivity } = await supabase
    .from("audit_logs")
    .select("*, profiles(name, email)")
    .order("timestamp", { ascending: false })
    .limit(10)

  // Calcular disponibilidade
  const total = totalMaterials || 0
  const available = availableMaterials || 0
  const availability = total > 0 ? Math.round((available / total) * 100) : 0

  return {
    totalMaterials: totalMaterials || 0,
    availableMaterials: available,
    cauteladoMaterials: cauteladoMaterials || 0,
    maintenanceMaterials: maintenanceMaterials || 0,
    totalPersons: totalPersons || 0,
    openCautelas: openCautelas || 0,
    totalCautelas: totalCautelas || 0,
    dailyExpiring: dailyExpiring || 0,
    divergentCautelas: divergentCautelas || 0,
    availability,
    recentActivity: recentActivity || [],
  }
}
