import type { SupabaseClient } from "@supabase/supabase-js"

export type MaterialActiveDetail = {
  cautelaId: string
  personName: string
  personRg?: string
  personMatricula?: string
  personFunction?: string
  operatorName: string
  cautelaCreatedAt: string
  cautelaType: string
}

type OpenCautelaRow = {
  id: string
  created_at: string
  type: string
  persons: {
    full_name?: string
    rg?: string
    function?: string
    registration_number?: string
  } | null
  profiles: { name?: string } | null
  cautela_items: { material_id: string; returned: boolean }[] | null
}

/** Mapa material_id → cautela ativa (item não devolvido em cautela open/partial). */
export async function buildActiveMaterialMap(
  supabase: SupabaseClient
): Promise<Map<string, MaterialActiveDetail>> {
  const map = new Map<string, MaterialActiveDetail>()

  const { data: openCautelas, error } = await supabase
    .from("cautelas")
    .select(`
      id, created_at, type,
      persons(full_name, rg, function, registration_number),
      profiles(name),
      cautela_items(material_id, returned)
    `)
    .in("status", ["open", "partial"])

  if (error) {
    console.error("[material-active-detail] open cautelas query", error.message)
    return map
  }

  for (const c of (openCautelas ?? []) as OpenCautelaRow[]) {
    for (const item of c.cautela_items ?? []) {
      if (item.returned) continue
      map.set(item.material_id, {
        cautelaId: c.id,
        personName: c.persons?.full_name || "Desconhecido",
        personRg: c.persons?.rg || undefined,
        personMatricula: c.persons?.registration_number || undefined,
        personFunction: c.persons?.function || undefined,
        operatorName: c.profiles?.name || "Sistema",
        cautelaCreatedAt: c.created_at,
        cautelaType: c.type,
      })
    }
  }

  return map
}
