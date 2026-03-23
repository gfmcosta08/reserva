"use server"

import { createClient } from "@/lib/supabase-server"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const categorySchema = z.object({
  name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres"),
})

export async function getCategories() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name")

  if (error) throw new Error(error.message)
  return data
}

export async function createCategory(formData: FormData) {
  const supabase = createClient()
  const name = formData.get("name") as string

  const result = categorySchema.safeParse({ name })
  if (!result.success) {
    return { error: result.error.errors[0].message }
  }

  const { error } = await supabase
    .from("categories")
    .insert({ name: result.data.name })

  if (error) return { error: error.message }

  revalidatePath("/materials")
  return { success: true }
}

export async function updateCategory(id: string, name: string) {
  const supabase = createClient()
  
  const result = categorySchema.safeParse({ name })
  if (!result.success) {
    return { error: result.error.errors[0].message }
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
  const supabase = createClient()
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/materials")
  return { success: true }
}
