"use server"

import { createClient } from "@/lib/supabase-server"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const materialSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  category: z.string().min(2, "Informe a categoria"),
  patrimony_number: z.string().min(1, "Patrimônio é obrigatório"),
  serial_number: z.string().optional(),
  internal_code: z.string().min(1, "Código interno é obrigatório"),
  reservation_id: z.string().optional(),
  notes: z.string().optional(),
})

export async function getMaterials(filters?: {
  status?: string
  category?: string
  search?: string
  name?: string
  reservation_id?: string
}) {
  const supabase = await createClient()
  let query = supabase.from("materials").select("*").order("created_at", { ascending: false })

  if (filters?.status) {
    query = query.eq("status", filters.status)
  }
  if (filters?.category) {
    query = query.eq("category", filters.category)
  }
  if (filters?.name) {
    query = query.eq("name", filters.name)
  }
  if (filters?.reservation_id) {
    query = query.eq("reservation_id", filters.reservation_id)
  }
  if (filters?.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,patrimony_number.ilike.%${filters.search}%,internal_code.ilike.%${filters.search}%,reservation_id.ilike.%${filters.search}%`
    )
  }

  const { data, error } = await query

  if (error) {
    console.error("[getMaterials]", error.message, error)
    return []
  }
  return data ?? []
}

export async function createMaterial(data: z.infer<typeof materialSchema>) {
  const supabase = await createClient()
  const result = materialSchema.safeParse(data)

  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  const { error } = await supabase.from("materials").insert(result.data)

  if (error) return { error: error.message }

  revalidatePath("/materials")
  return { success: true }
}

export async function updateMaterial(id: string, data: Partial<z.infer<typeof materialSchema>>) {
  const supabase = await createClient()
  const { error } = await supabase.from("materials").update(data).eq("id", id)

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

export async function importMaterialsCsv(csvText: string) {
  const supabase = await createClient()
  try {
    const lines = csvText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l)
    if (lines.length <= 1) return { error: "Arquivo vazio ou inválido" }

    const parseCSVLine = (text: string) => {
      const re_value =
        /(?!\s*$)\s*(?:'([^'\\]*(?:\\[\s\S][^'\\]*)*)'|"([^"\\]*(?:\\[\s\S][^"\\]*)*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g
      const a: string[] = []
      text.replace(re_value, function (m0, m1, m2, m3) {
        if (m1 !== undefined) a.push(m1.replace(/\\'/g, "'"))
        else if (m2 !== undefined) a.push(m2.replace(/\\"/g, '"'))
        else if (m3 !== undefined) a.push(m3)
        return ""
      })
      return text.split(",").map((val, i) => a[i] || val.trim())
    }

    let count = 0

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      const vals = parseCSVLine(line)
      if (vals.length < 5) continue

      const [nome, patrimonio, codigoInterno, numeroSerie, idReserva, categoria, observacoes] = vals

      if (!nome || !patrimonio || !codigoInterno) continue

      const category = (categoria || "Geral").trim()
      if (category.length < 2) continue

      const { error } = await supabase.from("materials").insert({
        name: nome,
        patrimony_number: patrimonio,
        internal_code: codigoInterno,
        serial_number: numeroSerie || null,
        reservation_id: idReserva || null,
        category,
        notes: observacoes || null,
        status: "available",
      })

      if (!error) count++
    }

    revalidatePath("/materials")
    return { success: true, count }
  } catch (err: any) {
    return { error: err.message }
  }
}
