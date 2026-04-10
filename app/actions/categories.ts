"use server"

import { createClient } from "@/lib/supabase-server"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const categorySchema = z.object({
  name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres"),
})

export async function getCategories() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name")

  if (!error) {
    return data ?? []
  }

  console.error("[categories] getCategories base query failed:", error.message)

  const { data: materialRows, error: materialError } = await supabase
    .from("materials")
    .select("category")

  if (materialError) {
    console.error("[categories] getCategories fallback query failed:", materialError.message)
    return []
  }

  const names = Array.from(
    new Set(
      (materialRows ?? [])
        .map((row: any) => row?.category)
        .filter((value: unknown): value is string => typeof value === "string" && value.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b, "pt-BR"))

  return names.map((name) => ({ id: name, name }))
}

export async function createCategory(formData: FormData) {
  const supabase = await createClient()
  const name = formData.get("name") as string

  const result = categorySchema.safeParse({ name })
  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  const { error } = await supabase
    .from("categories")
    .insert({ name: result.data.name })

  if (error) return { error: error.message }

  revalidatePath("/materials")
  return { success: true }
}

export async function updateCategory(id: string, name: string) {
  const supabase = await createClient()
  
  const result = categorySchema.safeParse({ name })
  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  const { error } = await supabase
    .from("categories")
    .update({ name: result.data.name })
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/materials")
  return { success: true }
}

export async function deleteCategory(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Usuário não autenticado" }
  
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "supervisor") {
    return { error: "Ação não permitida. Apenas supervisores podem excluir." }
  }

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/materials")
  return { success: true }
}
