import { getMaterialCategoryOptions, getMaterials, type MaterialsFilters } from "@/app/actions/materials"
import MaterialsClient from "@/components/MaterialsClient"
import { createClient } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"

type RawSearchParams =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined> | undefined>
  | undefined

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  if (typeof value === "string" && value.length > 0) return value
  return undefined
}

function multiParam(value: string | string[] | undefined): string[] | undefined {
  const list = (Array.isArray(value) ? value : [value])
    .filter((item): item is string => typeof item === "string")
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

  const deduped = Array.from(new Set(list))
  return deduped.length > 0 ? deduped : undefined
}

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams?: RawSearchParams
}) {
  const resolvedSearchParams = (await Promise.resolve(searchParams)) ?? {}

  const filters: MaterialsFilters = {
    search: firstParam(resolvedSearchParams.search),
    name: multiParam(resolvedSearchParams.name),
    reservation_id: multiParam(resolvedSearchParams.reservation_id),
    categories: multiParam(resolvedSearchParams.categories),
    category: multiParam(resolvedSearchParams.category),
    category_id: multiParam(resolvedSearchParams.category_id),
    status: multiParam(resolvedSearchParams.status),
  }

  const [materials, categoryOptions] = await Promise.all([
    getMaterials(filters).catch((error) => {
      console.error("[materials-page] getMaterials", error)
      return []
    }),
    getMaterialCategoryOptions().catch((error) => {
      console.error("[materials-page] getMaterialCategoryOptions", error)
      return []
    }),
  ])

  const supabase = await createClient()

  const { data: allMaterials } = await supabase.from("materials").select("name, reservation_id")
  const materialNames = Array.from(new Set(allMaterials?.map((m) => m.name))).filter(Boolean).sort() as string[]
  const locations = Array.from(new Set(allMaterials?.map((m) => m.reservation_id))).filter(Boolean).sort() as string[]

  return (
    <MaterialsClient
      initialMaterials={materials}
      categories={categoryOptions}
      materialNames={materialNames}
      locations={locations}
    />
  )
}
