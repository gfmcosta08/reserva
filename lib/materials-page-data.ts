import { createClient } from "@/lib/supabase-server"

export type MaterialsPageFilters = {
  search?: string
  category?: string
  status?: string
  name?: string
  reservation_id?: string
}

/** Dados da página /materials — módulo servidor comum (não é Server Action). */
export async function loadMaterialsPageData(filters: MaterialsPageFilters) {
  const supabase = await createClient()

  let query = supabase.from("materials").select("*").order("created_at", { ascending: false })

  if (filters.status) query = query.eq("status", filters.status)
  if (filters.category) query = query.eq("category", filters.category)
  if (filters.name) query = query.eq("name", filters.name)
  if (filters.reservation_id) query = query.eq("reservation_id", filters.reservation_id)
  if (filters.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,patrimony_number.ilike.%${filters.search}%,internal_code.ilike.%${filters.search}%,reservation_id.ilike.%${filters.search}%`
    )
  }

  const [{ data: materials, error: materialsError }, { data: catRows, error: catError }, { data: allMaterials, error: namesError }] =
    await Promise.all([
      query,
      supabase.from("materials").select("category"),
      supabase.from("materials").select("name, reservation_id"),
    ])

  if (materialsError) {
    console.error("[loadMaterialsPageData] materials", materialsError.message)
  }
  if (catError) {
    console.error("[loadMaterialsPageData] categories", catError.message)
  }
  if (namesError) {
    console.error("[loadMaterialsPageData] names/locations", namesError.message)
  }

  const categoryOptions = (() => {
    if (catError || !catRows) return [] as { name: string }[]
    const names = [...new Set(catRows.map((r) => r.category).filter(Boolean) as string[])].sort((a, b) =>
      a.localeCompare(b, "pt-BR")
    )
    return names.map((name) => ({ name }))
  })()

  const rows = allMaterials ?? []
  const materialNames = Array.from(new Set(rows.map((m) => m.name))).filter(Boolean).sort() as string[]
  const locations = Array.from(new Set(rows.map((m) => m.reservation_id))).filter(Boolean).sort() as string[]

  return {
    materials: materials ?? [],
    categoryOptions,
    materialNames,
    locations,
  }
}
