"use server"

import { createClient } from "@/lib/supabase-server"

function isMissingCategoriesColumnError(error: { message?: string } | null) {
  const message = error?.message ?? ""
  return /column .*categories.* does not exist/i.test(message)
}

function normalizeCategory(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "Sem Categoria"
}

export async function getReportData() {
  const supabase = await createClient()

  // 1. Todos os materiais com categoria textual
  const { data: materials } = await supabase
    .from("materials")
    .select("*")
    .order("name")

  const normalizedMaterials = (materials || []).map((material: any) => ({
    ...material,
    categories: normalizeCategory(material?.categories ?? material?.category),
  }))

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
      let { data: items, error: itemsError } = await supabase
        .from("cautela_items")
        .select("*, materials(name, patrimony_number, internal_code, serial_number, categories)")
        .eq("cautela_id", cautela.id)

      if (itemsError && isMissingCategoriesColumnError(itemsError)) {
        const fallback = await supabase
          .from("cautela_items")
          .select("*, materials(name, patrimony_number, internal_code, serial_number, category)")
          .eq("cautela_id", cautela.id)
        items = fallback.data
        itemsError = fallback.error
      }

      if (itemsError) {
        cautelasWithItems.push({ ...cautela, items: [] })
        continue
      }

      const normalizedItems = (items || []).map((item: any) => ({
        ...item,
        materials: item.materials
          ? {
              ...item.materials,
              categories: normalizeCategory(item.materials?.categories ?? item.materials?.category),
            }
          : item.materials,
      }))

      cautelasWithItems.push({ ...cautela, items: normalizedItems })
    }
  }

  // 3. Separar por tipo
  const permanentCautelas = cautelasWithItems.filter(c => c.type === "permanent")
  const dailyCautelas = cautelasWithItems.filter(c => c.type === "daily")

  // 4. Materiais disponíveis (não cautelados)
  const availableMaterials = normalizedMaterials.filter((m: any) => m.status === "available")
  const maintenanceMaterials = normalizedMaterials.filter((m: any) => m.status === "maintenance")
  const unavailableMaterials = normalizedMaterials.filter((m: any) => m.status === "unavailable")

  // 5. Operador logado
  const { data: { user } } = await supabase.auth.getUser()
  let operatorName = "Sistema"
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("name, email").eq("id", user.id).single()
    operatorName = profile?.name || profile?.email || "Sistema"
  }

  return {
    totalMaterials: normalizedMaterials.length || 0,
    availableMaterials,
    maintenanceMaterials,
    unavailableMaterials,
    permanentCautelas,
    dailyCautelas,
    operatorName,
    generatedAt: new Date().toISOString(),
  }
}
