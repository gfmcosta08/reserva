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
  phone: z.string().optional(),
  pin: z.string().length(4, "O PIN deve ter 4 dígitos"),
  face_descriptor: z.array(z.number()).optional(),
})

export async function getPersonById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from("persons").select("*").eq("id", id).single()
  if (error || !data) return { person: null, error: error?.message || "Pessoa não encontrada" }
  return { person: data, error: null }
}

const regularizeSchema = z.object({
  full_name: z.string().min(3, "Nome muito curto"),
  email: z.string().email("E-mail inválido"),
  function: z.string().optional(),
  phone: z.string().optional(),
  pin: z.string().length(4, "O PIN deve ter 4 dígitos").optional(),
  face_descriptor: z.array(z.number()).optional(),
})

export async function regularizePerson(
  id: string,
  data: z.infer<typeof regularizeSchema> & { rg_front_url?: string; rg_back_url?: string }
) {
  const supabase = await createClient()
  const { data: existing, error: fetchErr } = await supabase.from("persons").select("*").eq("id", id).single()
  if (fetchErr || !existing) return { error: "Pessoa não encontrada" }

  const parsed = regularizeSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const update: Record<string, unknown> = {
    full_name: parsed.data.full_name,
    email: parsed.data.email,
    function: parsed.data.function || null,
    phone: parsed.data.phone || null,
  }

  if (data.rg_front_url && !existing.rg_front_url) update.rg_front_url = data.rg_front_url
  if (data.rg_back_url && !existing.rg_back_url) update.rg_back_url = data.rg_back_url

  if (parsed.data.pin) {
    update.pin_hash = await bcrypt.hash(parsed.data.pin, 10)
  }

  if (parsed.data.face_descriptor && parsed.data.face_descriptor.length > 0) {
    update.face_descriptor = parsed.data.face_descriptor
  }

  const { error } = await supabase.from("persons").update(update).eq("id", id)
  if (error) {
    if (error.code === "23505") return { error: "E-mail já utilizado por outro cadastro" }
    return { error: error.message }
  }

  revalidatePath("/persons")
  revalidatePath(`/persons/${id}`)
  revalidatePath("/cautelas")
  return { success: true }
}

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
  rg_front_url?: string
  rg_back_url?: string
}) {
  const supabase = await createClient()

  // Validar campos base
  const result = personSchema.safeParse(data)
  if (!result.success) {
    return { error: result.error.issues[0].message }
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
    phone: result.data.phone || null,
    pin_hash,
    rg_front_url: data.rg_front_url || null,
    rg_back_url: data.rg_back_url || null,
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
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Usuário não autenticado" }
  
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "supervisor") {
    return { error: "Ação não permitida. Apenas supervisores podem excluir cadastros." }
  }

  const { error } = await supabase.from("persons").delete().eq("id", id)
  if (error) return { error: error.message }

  revalidatePath("/persons")
  return { success: true }
}

// Verificar se a pessoa tem as fotos pendentes
export async function checkPhotosPending(personId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from("persons").select("rg_front_url, rg_back_url").eq("id", personId).single()
  if (error) return { pending: true, missing: ["front", "back"] }

  const missing: string[] = []
  if (!data.rg_front_url) missing.push("front")
  if (!data.rg_back_url) missing.push("back")

  return { pending: missing.length > 0, missing }
}

// Anexar fotos pendentes a uma pessoa já cadastrada
export async function attachPhotos(personId: string, frontUrl?: string, backUrl?: string) {
  const supabase = await createClient()

  // Só pode anexar se o campo estiver vazio (imutável)
  const { data: person } = await supabase.from("persons").select("rg_front_url, rg_back_url").eq("id", personId).single()
  if (!person) return { error: "Pessoa não encontrada" }

  const update: any = {}
  if (frontUrl && !person.rg_front_url) update.rg_front_url = frontUrl
  if (backUrl && !person.rg_back_url) update.rg_back_url = backUrl

  if (Object.keys(update).length === 0) return { error: "Nenhuma foto nova para anexar" }

  const { error } = await supabase.from("persons").update(update).eq("id", personId)
  if (error) return { error: error.message }

  revalidatePath("/persons")
  return { success: true }
}

export async function getPersonCautelaHistory(personId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("cautelas")
    .select(`
      id, type, status, created_at, closed_at, notes,
      profiles(name),
      cautela_items(
        id, status, quantity_delivered, quantity_returned,
        materials(name, patrimony_number, category)
      )
    `)
    .eq("person_id", personId)
    .order("created_at", { ascending: false })

  if (error) return { cautelas: [], error: error.message }
  return { cautelas: data || [] }
}
