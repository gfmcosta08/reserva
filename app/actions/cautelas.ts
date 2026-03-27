"use server"

import { createClient } from "@/lib/supabase-server"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"
import { logAudit } from "./audit"

// ===== LISTAR CAUTELAS =====
export async function getCautelas(filters?: { status?: string; search?: string }) {
  const supabase = await createClient()
  let query = supabase
    .from("cautelas")
    .select(`
      *,
      persons!inner(full_name, rg, registration_number, rg_front_url, rg_back_url),
      profiles!inner(name, email)
    `)
    .order("created_at", { ascending: false })

  if (filters?.status) {
    query = query.eq("status", filters.status)
  }
  if (filters?.search) {
    query = query.ilike("persons.full_name", `%${filters.search}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  // Buscar contagem de itens para cada cautela
  if (data && data.length > 0) {
    const cautelaIds = data.map(c => c.id)
    const { data: items } = await supabase
      .from("cautela_items")
      .select("cautela_id, status")
      .in("cautela_id", cautelaIds)

    return data.map(cautela => {
      const cautelaItems = items?.filter(i => i.cautela_id === cautela.id) || []
      return {
        ...cautela,
        items_count: cautelaItems.length,
        items_returned: cautelaItems.filter(i => i.status === "returned").length,
        items_pending: cautelaItems.filter(i => i.status === "pending").length,
      }
    })
  }

  return data || []
}

// ===== DETALHES DE UMA CAUTELA =====
export async function getCautelaById(id: string) {
  const supabase = await createClient()

  const { data: cautela, error } = await supabase
    .from("cautelas")
    .select(`
      *,
      persons(id, full_name, rg, registration_number, function, rg_front_url, rg_back_url),
      profiles(name, email)
    `)
    .eq("id", id)
    .single()

  if (error) return { error: error.message }

  // Buscar itens com dados do material
  const { data: items } = await supabase
    .from("cautela_items")
    .select(`
      *,
      materials(id, name, patrimony_number, serial_number, internal_code, categories(name))
    `)
    .eq("cautela_id", id)

  return { cautela, items: items || [] }
}

// ===== VALIDAR PIN =====
export async function validatePin(personId: string, pin: string) {
  const supabase = await createClient()

  const { data: person, error } = await supabase
    .from("persons")
    .select("id, pin_hash, failed_pin_attempts, pin_locked_until")
    .eq("id", personId)
    .single()

  if (error || !person) return { valid: false, error: "Pessoa não encontrada" }

  // Verificar bloqueio
  if (person.pin_locked_until) {
    const lockUntil = new Date(person.pin_locked_until)
    if (lockUntil > new Date()) {
      const minutesLeft = Math.ceil((lockUntil.getTime() - Date.now()) / 60000)
      return { valid: false, error: `PIN bloqueado. Tente novamente em ${minutesLeft} minuto(s).` }
    }
    // Desbloqueio automático
    await supabase.from("persons").update({ failed_pin_attempts: 0, pin_locked_until: null }).eq("id", personId)
  }

  // Verificar PIN
  const isValid = await bcrypt.compare(pin, person.pin_hash)

  if (!isValid) {
    const attempts = (person.failed_pin_attempts || 0) + 1
    const update: Record<string, any> = { failed_pin_attempts: attempts }

    if (attempts >= 3) {
      const lockUntil = new Date(Date.now() + 15 * 60 * 1000) // 15 min
      update.pin_locked_until = lockUntil.toISOString()
    }

    await supabase.from("persons").update(update).eq("id", personId)
    return {
      valid: false,
      error: attempts >= 3
        ? "PIN bloqueado por 15 minutos após 3 tentativas."
        : `PIN incorreto. ${3 - attempts} tentativa(s) restante(s).`
    }
  }

  // Resetar tentativas
  await supabase.from("persons").update({ failed_pin_attempts: 0, pin_locked_until: null }).eq("id", personId)
  return { valid: true }
}

// ===== CRIAR CAUTELA =====
export async function createCautela(data: {
  person_id: string
  type: "daily" | "permanent"
  material_ids: string[]
  notes?: string
  pin: string
}) {
  const supabase = await createClient()

  // 1. Validar PIN
  const pinResult = await validatePin(data.person_id, data.pin)
  if (!pinResult.valid) return { error: pinResult.error }

  // 2. Verificar se os materiais estão disponíveis
  const { data: materials, error: matError } = await supabase
    .from("materials")
    .select("id, name, status")
    .in("id", data.material_ids)

  if (matError) return { error: matError.message }

  const unavailable = materials?.filter(m => m.status !== "available") || []
  if (unavailable.length > 0) {
    return { error: `Materiais indisponíveis: ${unavailable.map(m => m.name).join(", ")}` }
  }

  // 3. Obter operador logado
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Operador não autenticado" }

  // 4. Criar cautela
  const { data: cautela, error: cautelaError } = await supabase
    .from("cautelas")
    .insert({
      person_id: data.person_id,
      operator_id: user.id,
      type: data.type,
      status: "open",
      notes: data.notes || null,
    })
    .select("id")
    .single()

  if (cautelaError) return { error: cautelaError.message }

  // 5. Criar itens da cautela
  const items = data.material_ids.map(material_id => ({
    cautela_id: cautela.id,
    material_id,
    status: "pending",
  }))

  const { error: itemsError } = await supabase
    .from("cautela_items")
    .insert(items)

  if (itemsError) return { error: itemsError.message }

  // 6. Atualizar status dos materiais para 'cautelado'
  const { error: updateError } = await supabase
    .from("materials")
    .update({ status: "cautelado" })
    .in("id", data.material_ids)

  if (updateError) return { error: updateError.message }

  // 7. Audit log
  await logAudit({
    action: "cautela_created",
    entity: "cautelas",
    entity_id: cautela.id,
    after_state: { person_id: data.person_id, type: data.type, items: data.material_ids.length },
  })

  revalidatePath("/cautelas")
  revalidatePath("/materials")
  return { success: true, cautelaId: cautela.id }
}

// ===== DEVOLVER ITEM =====
export async function returnItem(cautelaItemId: string, status: "returned" | "damaged" | "missing", notes?: string) {
  const supabase = await createClient()

  // 1. Buscar item e material_id
  const { data: item, error: itemError } = await supabase
    .from("cautela_items")
    .select("id, material_id, cautela_id, status")
    .eq("id", cautelaItemId)
    .single()

  if (itemError || !item) return { error: "Item não encontrado" }
  if (item.status !== "pending") return { error: "Este item já foi processado" }

  // 2. Atualizar status do item
  const { error: updateItemError } = await supabase
    .from("cautela_items")
    .update({ status, notes: notes || null })
    .eq("id", cautelaItemId)

  if (updateItemError) return { error: updateItemError.message }

  // 3. Atualizar status do material
  const materialStatus = status === "returned" ? "available" : status === "damaged" ? "maintenance" : "unavailable"
  await supabase
    .from("materials")
    .update({ status: materialStatus })
    .eq("id", item.material_id)

  // 4. Verificar se todos os itens da cautela foram processados
  const { data: allItems } = await supabase
    .from("cautela_items")
    .select("status")
    .eq("cautela_id", item.cautela_id)

  const allDone = allItems?.every(i => i.status !== "pending")
  const hasDivergence = allItems?.some(i => i.status === "damaged" || i.status === "missing")

  if (allDone) {
    const cautelaStatus = hasDivergence ? "divergent" : "closed"
    await supabase
      .from("cautelas")
      .update({ status: cautelaStatus, closed_at: new Date().toISOString() })
      .eq("id", item.cautela_id)
  } else {
    // Marcar como parcial se pelo menos um foi devolvido
    const someReturned = allItems?.some(i => i.status !== "pending")
    if (someReturned) {
      await supabase
        .from("cautelas")
        .update({ status: "partial" })
        .eq("id", item.cautela_id)
    }
  }

  // Audit log
  const auditAction = status === "returned" ? "item_returned" : status === "damaged" ? "item_damaged" : "item_missing"
  await logAudit({
    action: auditAction,
    entity: "cautela_items",
    entity_id: cautelaItemId,
    after_state: { status, material_id: item.material_id, cautela_id: item.cautela_id },
  })

  revalidatePath("/cautelas")
  revalidatePath("/materials")
  return { success: true }
}

// ===== BUSCAR PESSOAS (para autocomplete no wizard) =====
export async function searchPersons(query: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("persons")
    .select("id, full_name, rg, registration_number, function, status, rg_front_url, rg_back_url, face_descriptor")
    .eq("status", "active")
    .or(`full_name.ilike.%${query}%,rg.ilike.%${query}%,registration_number.ilike.%${query}%`)
    .limit(10)

  if (error) return []
  return data
}

// ===== BUSCAR MATERIAIS DISPONÍVEIS =====
export async function getAvailableMaterials(categoryId?: string) {
  const supabase = await createClient()
  let query = supabase
    .from("materials")
    .select("id, name, patrimony_number, serial_number, internal_code, categories(name)")
    .eq("status", "available")
    .order("name")

  if (categoryId) {
    query = query.eq("category_id", categoryId)
  }

  const { data, error } = await query
  if (error) return []
  return data
}

// ===== VERIFICAR CAUTELAS DIÁRIAS PENDENTES DE UMA PESSOA =====
// Regra: Apenas cautelas DIÁRIAS geram alerta de pendência
// Cautelas Permanentes NÃO geram alerta (não possuem prazo de devolução)
export async function getPendingCautelasForPerson(personId: string) {
  const supabase = await createClient()

  // Buscar apenas cautelas DIÁRIAS pendentes
  const { data, error } = await supabase
    .from("cautelas")
    .select(`
      id, type, status, created_at, notes,
      profiles(name)
    `)
    .eq("person_id", personId)
    .eq("type", "daily") // FILTRO: Apenas cautelas DIÁRIAS
    .in("status", ["open", "partial"])
    .order("created_at", { ascending: false })

  if (error) return []

  // Se não há cautelas diárias pendentes, retornar vazio
  if (!data || data.length === 0) return []

  // Buscar os itens de cada cautela diária para mostrar detalhes
  const cautelaIds = data.map(c => c.id)
  const { data: items } = await supabase
    .from("cautela_items")
    .select(`
      id, cautela_id, status,
      materials(name, patrimony_number)
    `)
    .in("cautela_id", cautelaIds)
    .eq("status", "pending")

  // Verificar se há cautelas diárias vencidas (mais de 24h)
  const now = new Date()
  const vinteQuatroHorasAtras = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  return data?.map(cautela => {
    const cautelaItems = items?.filter(i => i.cautela_id === cautela.id) || []
    return {
      ...cautela,
      is_overdue: new Date(cautela.created_at) < vinteQuatroHorasAtras,
      items: cautelaItems,
      items_count: cautelaItems.length
    }
  }) || []
}

// ===== CRIAR CAUTELA COM VERIFICAÇÃO FACIAL (sem PIN) =====
export async function createCautelaFaceAuth(data: {
  person_id: string
  type: "daily" | "permanent"
  material_ids: string[]
  notes?: string
}) {
  const supabase = await createClient()

  // Verificar se os materiais estão disponíveis
  const { data: materials, error: matError } = await supabase
    .from("materials")
    .select("id, name, status")
    .in("id", data.material_ids)

  if (matError) return { error: matError.message }

  const unavailable = materials?.filter(m => m.status !== "available") || []
  if (unavailable.length > 0) {
    return { error: `Materiais indisponíveis: ${unavailable.map(m => m.name).join(", ")}` }
  }

  // Obter operador logado
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Operador não autenticado" }

  // Criar cautela
  const { data: cautela, error: cautelaError } = await supabase
    .from("cautelas")
    .insert({
      person_id: data.person_id,
      operator_id: user.id,
      type: data.type,
      status: "open",
      notes: data.notes || null,
    })
    .select("id")
    .single()

  if (cautelaError) return { error: cautelaError.message }

  // Criar itens
  const items = data.material_ids.map(material_id => ({
    cautela_id: cautela.id,
    material_id,
    status: "pending",
  }))

  const { error: itemsError } = await supabase
    .from("cautela_items")
    .insert(items)

  if (itemsError) return { error: itemsError.message }

  // Atualizar materiais para 'cautelado'
  const { error: updateError } = await supabase
    .from("materials")
    .update({ status: "cautelado" })
    .in("id", data.material_ids)

  if (updateError) return { error: updateError.message }

  // Audit log
  await logAudit({
    action: "cautela_created",
    entity: "cautelas",
    entity_id: cautela.id,
    after_state: { person_id: data.person_id, type: data.type, items: data.material_ids.length, auth: "face" },
  })

  revalidatePath("/cautelas")
  revalidatePath("/materials")
  return { success: true, cautelaId: cautela.id }
}
