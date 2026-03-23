"use server"

import { createClient } from "@/lib/supabase-server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import bcrypt from "bcryptjs"

const personSchema = z.object({
  full_name: z.string().min(3, "Nome muito curto"),
  email: z.string().email("E-mail inválido"),
  rg: z.string().min(4, "RG inválido"),
  registration_number: z.string().min(1, "Matrícula é obrigatória"),
  function: z.string().optional(),
  pin: z.string().length(4, "O PIN deve ter 4 dígitos"),
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

export async function uploadRgPhoto(formData: FormData): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient()
  const file = formData.get("file") as File
  const side = formData.get("side") as string // "front" ou "back"

  if (!file || file.size === 0) {
    return { error: "Arquivo não enviado" }
  }

  // Gerar nome único para impedir sobreescrita
  const timestamp = Date.now()
  const ext = file.name.split(".").pop() || "jpg"
  const path = `rg-documents/${timestamp}_${side}.${ext}`

  const { error } = await supabase.storage
    .from("documents")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false, // Nunca sobrescrever
    })

  if (error) {
    console.error("Upload error:", error)
    return { error: `Erro ao enviar foto: ${error.message}` }
  }

  const { data: urlData } = supabase.storage
    .from("documents")
    .getPublicUrl(path)

  return { url: urlData.publicUrl }
}

export async function createPerson(data: z.infer<typeof personSchema> & {
  rg_front_url: string
  rg_back_url: string
}) {
  const supabase = await createClient()

  // Validar campos base
  const result = personSchema.safeParse(data)
  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  // Validar fotos obrigatórias
  if (!data.rg_front_url || !data.rg_back_url) {
    return { error: "As duas fotos do RG (frente e verso) são obrigatórias" }
  }

  // Hash do PIN
  const pin_hash = await bcrypt.hash(result.data.pin, 10)

  // Limpar RG: apenas dígitos, sem barra/sufixo
  const cleanRg = result.data.rg.replace(/[\/\-]/g, "").replace(/\D/g, "").slice(0, 5)

  const { error } = await supabase.from("persons").insert({
    full_name: result.data.full_name,
    email: result.data.email,
    rg: cleanRg,
    registration_number: result.data.registration_number,
    function: result.data.function,
    pin_hash,
    rg_front_url: data.rg_front_url,
    rg_back_url: data.rg_back_url,
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

export async function updatePerson(id: string, data: Record<string, any>) {
  const supabase = await createClient()

  const updateData: any = { ...data }

  // Não permitir alterar fotos do RG
  delete updateData.rg_front_url
  delete updateData.rg_back_url

  if (data.pin) {
    updateData.pin_hash = await bcrypt.hash(data.pin, 10)
    delete updateData.pin
  }

  if (data.rg) {
    updateData.rg = data.rg.replace(/[\/\-]/g, "").replace(/\D/g, "").slice(0, 5)
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
