"use server"

import { createClient } from "@/lib/supabase-server"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const DEFAULT_CATEGORY = "Sem Categoria"

function normalizeCategory(value: string | null | undefined): string {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : DEFAULT_CATEGORY
}

const materialSchema = z.object({
  name: z.string().min(2, "Nome e obrigatorio"),
  categories: z.string().min(1, "Categoria e obrigatoria").transform(normalizeCategory),
  patrimony_number: z.string().min(1, "Patrimonio e obrigatorio"),
  serial_number: z.string().optional(),
  internal_code: z.string().min(1, "Codigo interno e obrigatorio"),
  reservation_id: z.string().optional(),
  notes: z.string().optional(),
})

const updateMaterialSchema = materialSchema.partial()

type MaterialsFilters = {
  status?: string
  categories?: string
  category?: string
  category_id?: string
  search?: string
  name?: string
  reservation_id?: string
}

async function resolveLegacyCategoryById(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categoryId?: string
) {
  if (!categoryId) return null

  const { data, error } = await supabase
    .from("categories")
    .select("name")
    .eq("id", categoryId)
    .maybeSingle()

  if (error) {
    return null
  }

  return typeof data?.name === "string" ? data.name : null
}

export async function getMaterials(filters?: MaterialsFilters) {
  const supabase = await createClient()
  let query = supabase.from("materials").select("*").order("created_at", { ascending: false })

  if (filters?.status) {
    query = query.eq("status", filters.status)
  }

  const categoryFilter = filters?.categories ?? filters?.category
  if (categoryFilter) {
    query = query.eq("categories", normalizeCategory(categoryFilter))
  } else if (filters?.category_id) {
    const resolved = await resolveLegacyCategoryById(supabase, filters.category_id)
    query = query.eq("categories", normalizeCategory(resolved ?? filters.category_id))
  }

  if (filters?.name) {
    query = query.eq("name", filters.name)
  }

  if (filters?.reservation_id) {
    query = query.eq("reservation_id", filters.reservation_id)
  }

  if (filters?.search) {
    const search = filters.search.trim()
    query = query.or(
      `name.ilike.%${search}%,patrimony_number.ilike.%${search}%,internal_code.ilike.%${search}%,reservation_id.ilike.%${search}%,categories.ilike.%${search}%`
    )
  }

  const { data, error } = await query

  if (error) {
    console.error("[materials] getMaterials failed:", error.message)
    return []
  }

  return (data ?? []).map((material: any) => ({
    ...material,
    categories: normalizeCategory(material?.categories),
  }))
}

export async function getMaterialCategoryOptions() {
  const supabase = await createClient()
  const { data, error } = await supabase.from("materials").select("categories")

  if (error) {
    console.error("[materials] getMaterialCategoryOptions failed:", error.message)
    return []
  }

  const categories = Array.from(
    new Set((data ?? []).map((row: any) => normalizeCategory(row?.categories)))
  )

  return categories.sort((a, b) => a.localeCompare(b, "pt-BR"))
}

export async function createMaterial(data: z.infer<typeof materialSchema>) {
  const supabase = await createClient()
  const result = materialSchema.safeParse(data)

  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  const payload = {
    ...result.data,
    categories: normalizeCategory(result.data.categories),
  }

  const { error } = await supabase.from("materials").insert(payload)

  if (error) return { error: error.message }

  revalidatePath("/materials")
  return { success: true }
}

export async function updateMaterial(id: string, data: Partial<z.infer<typeof materialSchema>>) {
  const supabase = await createClient()
  const result = updateMaterialSchema.safeParse(data)

  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  const payload = {
    ...result.data,
    ...(result.data.categories !== undefined
      ? { categories: normalizeCategory(result.data.categories) }
      : {}),
  }

  const { error } = await supabase.from("materials").update(payload).eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/materials")
  return { success: true }
}

export async function updateMaterialStatus(id: string, status: string, notes?: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("materials").update({ status, notes }).eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/materials")
  return { success: true }
}

function parseCSVLine(text: string) {
  const reValue =
    /(?!\s*$)\s*(?:'([^'\\]*(?:\\[\s\S][^'\\]*)*)'|"([^"\\]*(?:\\[\s\S][^"\\]*)*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g
  const values: string[] = []
  text.replace(reValue, function (_m0, m1, m2, m3) {
    if (m1 !== undefined) values.push(m1.replace(/\\'/g, "'"))
    else if (m2 !== undefined) values.push(m2.replace(/\\"/g, '"'))
    else if (m3 !== undefined) values.push(m3)
    return ""
  })

  return text.split(",").map((val, i) => values[i] || val.trim())
}

export async function importMaterialsCsv(csvText: string) {
  const supabase = await createClient()

  try {
    const lines = csvText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    if (lines.length <= 1) return { error: "Arquivo vazio ou invalido" }

    let count = 0

    for (let i = 1; i < lines.length; i++) {
      const vals = parseCSVLine(lines[i])
      if (vals.length < 5) continue

      const [nome, patrimonio, codigoInterno, numeroSerie, idReserva, categoria, observacoes] = vals

      if (!nome || !patrimonio || !codigoInterno) continue

      const payload = {
        name: nome,
        patrimony_number: patrimonio,
        internal_code: codigoInterno,
        serial_number: numeroSerie || null,
        reservation_id: idReserva || null,
        categories: normalizeCategory(categoria),
        notes: observacoes || null,
      }

      const { error } = await supabase.from("materials").upsert(payload, {
        onConflict: "internal_code",
        ignoreDuplicates: false,
      })

      if (!error) count++
    }

    revalidatePath("/materials")
    return { success: true, count }
  } catch (err: any) {
    return { error: err.message }
  }
}

