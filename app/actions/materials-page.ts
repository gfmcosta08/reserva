"use server"

import { createClient } from "@/lib/supabase-server"
import { loadMaterialsPageData, type MaterialsPageFilters } from "@/lib/materials-page-data"

export type MaterialsPageClientPayload = {
  initialMaterials: Record<string, unknown>[]
  categoryOptions: { name: string }[]
  materialNames: string[]
  locations: string[]
  listTruncated: boolean
  materialsTotalCount: number
}

function toJsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v))
  ) as T
}

/**
 * Carrega dados da tela /materials com a mesma sessão das outras Server Actions
 * (mais confiável em produção do que fetch em /api/... com cookies).
 */
export async function getMaterialsPagePayload(
  filters: MaterialsPageFilters
): Promise<{ ok: true; data: MaterialsPageClientPayload } | { ok: false; error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      error: "Sessão expirada ou inválida. Atualize a página e faça login novamente.",
    }
  }

  try {
    const payload = await loadMaterialsPageData(filters)
    const data: MaterialsPageClientPayload = {
      initialMaterials: payload.materials,
      categoryOptions: payload.categoryOptions,
      materialNames: payload.materialNames,
      locations: payload.locations,
      listTruncated: payload.listTruncated,
      materialsTotalCount: payload.materialsTotalCount,
    }
    return { ok: true, data: toJsonSafe(data) }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[materials-page] getMaterialsPagePayload", msg, e)
    return { ok: false, error: msg }
  }
}
