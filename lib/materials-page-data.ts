import { createClient } from "@/lib/supabase-server"
import { MATERIALS_FILTER_META_ROW_LIMIT, MATERIALS_LIST_ROW_LIMIT } from "@/lib/materials-list-limit"

/** Colunas necessárias na UI de materiais (evita `select *` pesado e problemas de serialização). */
const MATERIAL_LIST_COLUMNS =
  "id, name, patrimony_number, serial_number, internal_code, reservation_id, category, status, notes, created_at, updated_at"

export type MaterialsPageFilters = {
  search?: string
  category?: string
  status?: string
  name?: string
  reservation_id?: string
}

export type MaterialsPagePayload = {
  materials: Record<string, unknown>[]
  categoryOptions: { name: string }[]
  materialNames: string[]
  locations: string[]
  /** true se existirem mais linhas que o limite para os filtros atuais */
  listTruncated: boolean
  /** Total de linhas que correspondem aos filtros (PostgREST count) */
  materialsTotalCount: number
}

/** Dados da página /materials — módulo servidor comum (não é Server Action). */
export async function loadMaterialsPageData(filters: MaterialsPageFilters): Promise<MaterialsPagePayload> {
  const supabase = await createClient()

  let query = supabase
    .from("materials")
    .select(MATERIAL_LIST_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(MATERIALS_LIST_ROW_LIMIT)

  if (filters.status) query = query.eq("status", filters.status)
  if (filters.category) query = query.eq("category", filters.category)
  if (filters.name) query = query.eq("name", filters.name)
  if (filters.reservation_id) query = query.eq("reservation_id", filters.reservation_id)
  if (filters.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,patrimony_number.ilike.%${filters.search}%,internal_code.ilike.%${filters.search}%,reservation_id.ilike.%${filters.search}%`
    )
  }

  const [{ data: materials, error: materialsError, count: materialsCount }, { data: catRows, error: catError }, { data: allMaterials, error: namesError }] =
    await Promise.all([
      query,
      supabase.from("materials").select("category").limit(MATERIALS_FILTER_META_ROW_LIMIT),
      supabase
        .from("materials")
        .select("name, reservation_id")
        .limit(MATERIALS_FILTER_META_ROW_LIMIT),
    ])

  const rowCount = materials?.length ?? 0
  const total = materialsCount ?? rowCount
  const listTruncated = total > MATERIALS_LIST_ROW_LIMIT

  console.info(
    "[materials-page] loadMaterialsPageData",
    JSON.stringify({
      phase: "after_queries",
      rowCount,
      materialsTotalCount: total,
      listTruncated,
      limit: MATERIALS_LIST_ROW_LIMIT,
      hasMaterialsError: !!materialsError,
      hasCatError: !!catError,
      hasNamesError: !!namesError,
    })
  )

  if (materialsError) {
    console.error("[materials-page] materials query", materialsError.message, materialsError)
  }
  if (catError) {
    console.error("[materials-page] categories query", catError.message, catError)
  }
  if (namesError) {
    console.error("[materials-page] names/locations query", namesError.message, namesError)
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
    materials: (materials ?? []) as Record<string, unknown>[],
    categoryOptions,
    materialNames,
    locations,
    listTruncated,
    materialsTotalCount: total,
  }
}
