"use server"

import { createClient } from "@/lib/supabase-server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import bcrypt from "bcryptjs"

const personSchema = z.object({
  full_name: z.string().min(3, "Nome muito curto"),
  rg: z.string().min(5, "RG inválido"),
  registration_number: z.string().min(1, "Matrícula é obrigatória"),
  function: z.string().optional(),
  pin: z.string().length(4, "O PIN deve ter 4 dígitos"),
  photo_url: z.string().optional(),
  face_descriptor: z.array(z.number()).optional(),
})

export async function getPersons(query?: string) {
  const supabase = await createClient()
  let q = supabase.from("persons").select("*").order("full_name")

  if (query) {
    q = q.or(`full_name.ilike.%${query}%,rg.ilike.%${query}%,registration_number.ilike.%${query}%`)
  }

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data
}

export async function createPerson(data: z.infer<typeof personSchema>) {
  const supabase = await createClient()
  
  // Validar
  const result = personSchema.safeParse(data)
  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  // Hash do PIN
  const pin_hash = await bcrypt.hash(result.data.pin, 10)

  // Salvar
  const { error } = await supabase.from("persons").insert({
    full_name: result.data.full_name,
    rg: result.data.rg.replace(/\D/g, "").slice(0, 5), // Garantir apenas os 5 dígitos principais
    registration_number: result.data.registration_number,
    function: result.data.function,
    pin_hash,
    photo_url: result.data.photo_url,
    face_descriptor: result.data.face_descriptor,
  })

  if (error) {
    if (error.code === "23505") {
      return { error: "RG ou Matrícula já cadastrada no sistema" }
    }
    return { error: error.message }
  }

  revalidatePath("/persons")
  return { success: true }
}

export async function updatePerson(id: string, data: Partial<z.infer<typeof personSchema>>) {
  const supabase = await createClient()
  
  const updateData: any = { ...data }
  if (data.pin) {
    updateData.pin_hash = await bcrypt.hash(data.pin, 10)
    delete updateData.pin
  }

  if (data.rg) {
    updateData.rg = data.rg.replace(/\D/g, "")
  }

  const { error } = await supabase.from("persons").update(updateData).eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/persons")
  return { success: true }
}

export async function deletePerson(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("persons").delete().eq("id", id)
  if (error) return { error: error.message }

  revalidatePath("/persons")
  return { success: true }
}
