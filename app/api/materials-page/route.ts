import { createClient } from "@/lib/supabase-server"
import { loadMaterialsPageData, type MaterialsPageFilters } from "@/lib/materials-page-data"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

function toJsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v))
  ) as T
}

function filtersFromSearchParams(sp: URLSearchParams): MaterialsPageFilters {
  return {
    search: sp.get("search") ?? undefined,
    category: sp.get("category") ?? undefined,
    status: sp.get("status") ?? undefined,
    name: sp.get("name") ?? undefined,
    reservation_id: sp.get("reservation_id") ?? undefined,
  }
}

/** Dados da tela /materials em JSON (evita payload RSC gigante no Server Component). */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const filters = filtersFromSearchParams(request.nextUrl.searchParams)
    const payload = await loadMaterialsPageData(filters)

    const body = toJsonSafe({
      initialMaterials: payload.materials,
      categoryOptions: payload.categoryOptions,
      materialNames: payload.materialNames,
      locations: payload.locations,
      listTruncated: payload.listTruncated,
      materialsTotalCount: payload.materialsTotalCount,
    })

    return NextResponse.json(body)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[materials-page] api GET", msg, e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
