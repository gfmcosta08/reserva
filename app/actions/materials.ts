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
  reservation_id: z.string().optional(),
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
    query = query.or(`name.ilike.%${filters.search}%,patrimony_number.ilike.%${filters.search}%,internal_code.ilike.%${filters.search}%,reservation_id.ilike.%${filters.search}%`)
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

export async function importMaterialsCsv(csvText: string) {
  const supabase = await createClient()
  try {
    const lines = csvText.split('\n').map(l => l.trim()).filter(l => l)
    if (lines.length <= 1) return { error: "Arquivo vazio ou inválido" }

    const headers = lines[0].split(',')

    // Helper para extrair valores considerando aspas
    const parseCSVLine = (text: string) => {
      const re_value = /(?!\s*$)\s*(?:'([^'\\]*(?:\\[\s\S][^'\\]*)*)'|"([^"\\]*(?:\\[\s\S][^"\\]*)*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g;
      const a: string[] = [];                     
      text.replace(re_value, function(m0, m1, m2, m3) {
          if      (m1 !== undefined) a.push(m1.replace(/\\'/g, "'"));
          else if (m2 !== undefined) a.push(m2.replace(/\\"/g, '"'));
          else if (m3 !== undefined) a.push(m3);
          return '';
      });
      // Lidar com colunas vazias
      return text.split(',').map((val, i) => a[i] || val.trim());
    };

    let count = 0
    let currentCategoryId = null
    const categoryCache = new Map<string, string>()

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i]
        const vals = parseCSVLine(line)
        if (vals.length < 5) continue

        const [nome, patrimonio, codigoInterno, numeroSerie, idReserva, categoria, observacoes] = vals

        if (!nome || !patrimonio || !codigoInterno) continue

        // Tratar categoria
        let catId = null
        const catName = categoria || "Geral"
        
        if (categoryCache.has(catName)) {
            catId = categoryCache.get(catName)
        } else {
            // Buscar ou criar
            const { data: catData } = await supabase.from("categories").select("id").ilike("name", catName).single()
            if (catData) {
                catId = catData.id
                categoryCache.set(catName, catId)
            } else {
                const { data: newCat } = await supabase.from("categories").insert({ name: catName }).select("id").single()
                if (newCat) {
                    catId = newCat.id
                    categoryCache.set(catName, catId)
                }
            }
        }

        if (!catId) continue

        // Inserir ou atualizar material (usaremos insert simples por enquanto, sem upsert pra evitar conflito de constraint complexa)
        const { error } = await supabase.from("materials").insert({
            name: nome,
            patrimony_number: patrimonio,
            internal_code: codigoInterno,
            serial_number: numeroSerie || null,
            reservation_id: idReserva || null,
            category_id: catId,
            notes: observacoes || null,
            status: "available"
        })

        if (!error) count++
    }

    revalidatePath("/materials")
    revalidatePath("/categories")
    return { success: true, count }
  } catch (err: any) {
    return { error: err.message }
  }
}
