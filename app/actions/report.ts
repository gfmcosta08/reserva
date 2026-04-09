"use server"

import { createClient } from "@/lib/supabase-server"

export async function getReportData() {
  const supabase = await createClient()

  // 1. Todos os materiais com categoria
  const { data: materials } = await supabase
    .from("materials")
    .select("*")
    .order("name")

  // 2. Cautelas abertas/parciais com itens e pessoa
  const { data: openCautelas } = await supabase
    .from("cautelas")
    .select(`
      *,
      persons(full_name, rg, registration_number, function),
      profiles(name, email)
    `)
    .in("status", ["open", "partial"])
    .order("created_at", { ascending: false })

  // Para cada cautela, buscar itens
  const cautelasWithItems = []
  if (openCautelas) {
    for (const cautela of openCautelas) {
      const { data: items } = await supabase
        .from("cautela_items")
        .select("*, materials(name, patrimony_number, internal_code, serial_number, category)")
        .eq("cautela_id", cautela.id)

      cautelasWithItems.push({ ...cautela, items: items || [] })
    }
  }

  // 3. Separar por tipo
  const permanentCautelas = cautelasWithItems.filter(c => c.type === "permanent")
  const dailyCautelas = cautelasWithItems.filter(c => c.type === "daily")

  // 4. Materiais disponíveis (não cautelados)
  const availableMaterials = (materials || []).filter((m: any) => m.status === "available")
  const maintenanceMaterials = (materials || []).filter((m: any) => m.status === "maintenance")
  const unavailableMaterials = (materials || []).filter((m: any) => m.status === "unavailable")

  // 5. Operador logado
  const { data: { user } } = await supabase.auth.getUser()
  let operatorName = "Sistema"
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("name, email").eq("id", user.id).single()
    operatorName = profile?.name || profile?.email || "Sistema"
  }

  return {
    totalMaterials: materials?.length || 0,
    availableMaterials,
    maintenanceMaterials,
    unavailableMaterials,
    permanentCautelas,
    dailyCautelas,
    operatorName,
    generatedAt: new Date().toISOString(),
  }
}
