"use server"

import { createClient } from "@/lib/supabase-server"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const materialSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  category_id: z.string().uuid("Selecione uma categoria"),
  patrimony_number: z.string().min(1, "Patrimônio é obrigatório"),
  serial_number: z.string().optional(),
  internal_code: z.string().min(1, "Código interno é obrigatório"),
  notes: z.string().optional(),
})

export async function getMaterials(filters?: { status?: string; category_id?: string; search?: string }) {
  const supabase = await createClient()
  let query = supabase
    .from("materials")
    .select("*, categories(name)")
    .order("created_at", { ascending: false })

  if (filters?.status) {
    query = query.eq("status", filters.status)
  }
  if (filters?.category_id) {
    query = query.eq("category_id", filters.category_id)
  }
  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,patrimony_number.ilike.%${filters.search}%,internal_code.ilike.%${filters.search}%`)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)
  return data
}

export async function createMaterial(data: z.infer<typeof materialSchema>) {
  const supabase = await createClient()
  const result = materialSchema.safeParse(data)
  
  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  const { error } = await supabase
    .from("materials")
    .insert(result.data)

  if (error) return { error: error.message }

  revalidatePath("/materials")
  return { success: true }
}

export async function updateMaterial(id: string, data: Partial<z.infer<typeof materialSchema>>) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("materials")
    .update(data)
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/materials")
  return { success: true }
}

export async function updateMaterialStatus(id: string, status: string, notes?: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("materials")
    .update({ status, notes })
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/materials")
  return { success: true }
}
