"use server"

import { createClient } from "@/lib/supabase-server"

/** Nomes de categoria distintos já usados em materiais (ordenados). */
export async function getMaterialCategoryOptions(): Promise<{ name: string }[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("materials").select("category")

  if (error) {
    console.error("[getMaterialCategoryOptions]", error.message)
    return []
  }
  const names = [...new Set((data ?? []).map((r) => r.category).filter(Boolean) as string[])].sort(
    (a, b) => a.localeCompare(b, "pt-BR")
  )
  return names.map((name) => ({ name }))
}
