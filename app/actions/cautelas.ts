"use server"

import { createClient } from "@/lib/supabase-server"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"
import { logAudit } from "./audit"
import { requireCautelaOperator } from "@/lib/auth-cautela"
import {
  formatUnavailableMaterialsMessage,
  validateCautelaModifiable,
} from "@/lib/cautela-helpers"
import {
  createCautelaFaceAuthInputSchema,
  createCautelaInputSchema,
  processBulkDevolutionInputSchema,
  uuidSchema,
} from "@/lib/cautela-schemas"

function mapCreateCautelaRpcError(message: string): string {
  if (message.includes("EMPTY_MATERIALS")) {
    return "Selecione pelo menos um material"
  }
  if (message.includes("MATERIALS_NOT_ALL_AVAILABLE")) {
    return "Um ou mais materiais não estão mais disponíveis. Atualize a lista e tente novamente."
  }
  if (message.includes("NOT_AUTHENTICATED")) {
    return "Sessão inválida. Faça login novamente."
  }
  return message
}

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
  const parsed = createCautelaInputSchema.safeParse(data)
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors
    const msg =
      (Object.values(first)[0] as string[] | undefined)?.[0] ||
      "Dados inválidos para abertura da cautela"
    return { error: msg }
  }

  const auth = await requireCautelaOperator()
  if ("error" in auth) return { error: auth.error }

  const supabase = await createClient()
  const payload = parsed.data

  const pinResult = await validatePin(payload.person_id, payload.pin)
  if (!pinResult.valid) return { error: pinResult.error }

  const { data: materials, error: matError } = await supabase
    .from("materials")
    .select("id, name, status")
    .in("id", payload.material_ids)

  if (matError) return { error: matError.message }
  if (!materials || materials.length !== payload.material_ids.length) {
    return { error: "Um ou mais materiais não foram encontrados" }
  }

  const unavailable = materials.filter((m) => m.status !== "available")
  if (unavailable.length > 0) {
    return { error: formatUnavailableMaterialsMessage(unavailable) }
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc("create_cautela_atomic", {
    p_person_id: payload.person_id,
    p_type: payload.type,
    p_notes: payload.notes ?? null,
    p_material_ids: payload.material_ids,
  })

  if (rpcError) {
    return { error: mapCreateCautelaRpcError(rpcError.message) }
  }

  const result = rpcData as { cautela_id: string; cautela_item_ids?: string[] } | null
  const cautelaId = result?.cautela_id
  if (!cautelaId) {
    return { error: "Falha ao criar cautela" }
  }

  await logAudit({
    action: "cautela_created",
    entity: "cautelas",
    entity_id: cautelaId,
    after_state: {
      person_id: payload.person_id,
      type: payload.type,
      materials_count: payload.material_ids.length,
      material_ids: payload.material_ids,
      cautela_item_ids: result?.cautela_item_ids ?? [],
    },
  })

  revalidatePath("/cautelas")
  revalidatePath("/materials")
  return { success: true, cautelaId }
}

// ===== DEVOLVER ITEM (com suporte a quantidade) =====
export async function returnItem(
  cautelaItemId: string,
  status: "returned" | "damaged" | "missing",
  notes?: string,
  quantityReturned?: number
) {
  const idParsed = uuidSchema.safeParse(cautelaItemId)
  if (!idParsed.success) {
    return { error: "Identificador de item inválido" }
  }

  const auth = await requireCautelaOperator()
  if ("error" in auth) return { error: auth.error }

  const operatorId = auth.user.id
  const supabase = await createClient()

  // 1. Buscar item e material_id
  const { data: item, error: itemError } = await supabase
    .from("cautela_items")
    .select("id, material_id, cautela_id, status, quantity_delivered")
    .eq("id", cautelaItemId)
    .single()

  if (itemError || !item) return { error: "Item não encontrado" }
  if (item.status !== "pending") return { error: "Este item já foi processado" }

  // Determinar quantidade devolvida
  const qtyDelivered = item.quantity_delivered || 1
  const qtyReturn = (status === "damaged" || status === "missing")
    ? 0
    : (quantityReturned ?? qtyDelivered)

  // Validar quantidade
  if (qtyReturn < 0 || qtyReturn > qtyDelivered) {
    return { error: `Quantidade inválida. Deve estar entre 0 e ${qtyDelivered}` }
  }

  // 2. Atualizar status do item
  const { error: updateItemError } = await supabase
    .from("cautela_items")
    .update({
      status,
      notes: notes || null,
      quantity_returned: qtyReturn,
      returned_at: new Date().toISOString(),
      returned_by: operatorId
    })
    .eq("id", cautelaItemId)

  if (updateItemError) return { error: updateItemError.message }

  // 3. Atualizar status do material
  let materialStatus: string
  if (status === "returned") {
    materialStatus = qtyReturn === qtyDelivered ? "available" : "pending_return"
  } else if (status === "damaged") {
    materialStatus = "maintenance"
  } else {
    materialStatus = "unavailable"
  }

  await supabase
    .from("materials")
    .update({ status: materialStatus })
    .eq("id", item.material_id)

  // 4. Verificar se todos os itens da cautela foram processados
  const { data: allItems } = await supabase
    .from("cautela_items")
    .select("status, quantity_delivered, quantity_returned")
    .eq("cautela_id", item.cautela_id)

  const allDone = allItems?.every(i => i.status !== "pending")
  const hasDivergence = allItems?.some(i =>
    i.status === "damaged" ||
    i.status === "missing" ||
    (i.quantity_returned !== undefined && i.quantity_returned < (i.quantity_delivered || 1))
  )

  if (allDone) {
    const cautelaStatus = hasDivergence ? "divergent" : "closed"
    const closedAt = new Date().toISOString()
    await supabase
      .from("cautelas")
      .update({ status: cautelaStatus, closed_at: closedAt })
      .eq("id", item.cautela_id)

    const { data: operatorProfile } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("id", operatorId)
      .single()

    await logAudit({
      action: "cautela_closed",
      entity: "cautelas",
      entity_id: item.cautela_id,
      after_state: {
        status: cautelaStatus,
        closed_at: closedAt,
        operator_id: operatorId,
        operator_name: operatorProfile?.name || operatorProfile?.email,
        items_total: allItems?.length,
      },
    })
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
    after_state: {
      status,
      quantity_returned: qtyReturn,
      quantity_delivered: qtyDelivered,
      material_id: item.material_id,
      cautela_id: item.cautela_id
    }
  })

  revalidatePath("/cautelas")
  revalidatePath("/materials")
  return { success: true }
}

// ===== PROCESSAR DEVOLUÇÃO EM LOTE (NOVO FLUXO COM TICK) =====
// Tipos de dados para o novo fluxo
export interface DevolutionItemData {
  cautelaItemId: string
  // Opção 1: Devolução completa via tick
  confirmed: boolean
  // Opção 2: Devolução parcial via quantidade
  quantityReturned?: number
  notes?: string
}

export interface ProcessDevolutionResult {
  success: boolean
  error?: string
  processedCount?: number
  pendingItems?: string[]
}

export async function processBulkDevolution(
  cautelaId: string,
  items: DevolutionItemData[]
): Promise<ProcessDevolutionResult> {
  const parsed = processBulkDevolutionInputSchema.safeParse({ cautelaId, items })
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors
    const msg = (Object.values(first)[0] as string[] | undefined)?.[0] || "Dados inválidos para devolução"
    return { success: false, error: msg }
  }

  const auth = await requireCautelaOperator()
  if ("error" in auth) return { success: false, error: auth.error }

  const operatorId = auth.user.id
  const supabase = await createClient()

  // 1. Validar que todos os itens precisam de ação
  const { data: cautelaItems, error: itemsError } = await supabase
    .from("cautela_items")
    .select(`
      id, material_id, status, quantity_delivered,
      materials(id, name, patrimony_number)
    `)
    .eq("cautela_id", cautelaId)
    .eq("status", "pending")

  if (itemsError) return { success: false, error: itemsError.message }
  if (!cautelaItems || cautelaItems.length === 0) {
    return { success: false, error: "Nenhum item pendente encontrado nesta cautela" }
  }

  // 2. Validar que todos os itens pendentes foram processados
  const pendingIds = cautelaItems.map(i => i.id)
  const processedIds = items.map(i => i.cautelaItemId)
  const unprocessedItems = pendingIds.filter(id => !processedIds.includes(id))

  if (unprocessedItems.length > 0) {
    const unprocessedNames = cautelaItems
      .filter(i => unprocessedItems.includes(i.id))
      .map(i => i.materials?.[0]?.name || i.materials?.[0]?.patrimony_number || "Item")
    return {
      success: false,
      error: `Existem itens que não foram conferidos: ${unprocessedNames.join(", ")}`,
      pendingItems: unprocessedItems
    }
  }

  // 3. Validar cada item
  for (const item of items) {
    const cautelaItem = cautelaItems.find(ci => ci.id === item.cautelaItemId)
    if (!cautelaItem) {
      return { success: false, error: `Item ${item.cautelaItemId} não encontrado` }
    }

    const quantityDelivered = cautelaItem.quantity_delivered || 1

    // Validar que tick OU quantidade foi preenchida
    if (!item.confirmed && (item.quantityReturned === undefined || item.quantityReturned === null)) {
      return {
        success: false,
        error: `Item "${cautelaItem.materials?.[0]?.name || cautelaItem.materials?.[0]?.patrimony_number}" não possui confirmação nem quantidade preenchida`
      }
    }

    // Validar quantidade não seja negativa
    if (item.quantityReturned !== undefined && item.quantityReturned < 0) {
      return {
        success: false,
        error: `Quantidade não pode ser negativa para "${cautelaItem.materials?.[0]?.name}"`
      }
    }

    // Validar quantidade não seja maior que entregue
    if (item.quantityReturned !== undefined && item.quantityReturned > quantityDelivered) {
      return {
        success: false,
        error: `Quantidade devolvida não pode ser maior que a entregue para "${cautelaItem.materials?.[0]?.name}"`
      }
    }
  }

  // 4. Processar cada item
  const now = new Date().toISOString()
  let processedCount = 0

  for (const item of items) {
    const cautelaItem = cautelaItems.find(ci => ci.id === item.cautelaItemId)
    if (!cautelaItem) continue

    const quantityDelivered = cautelaItem.quantity_delivered || 1
    let finalStatus: "returned" | "partial" = "returned"
    let quantityReturned = quantityDelivered

    if (item.confirmed) {
      // Opção 1: Tick marcado = devolução completa
      finalStatus = "returned"
      quantityReturned = quantityDelivered
    } else if (item.quantityReturned !== undefined) {
      // Opção 2: Devolução parcial
      quantityReturned = item.quantityReturned
      if (quantityReturned < quantityDelivered) {
        finalStatus = "partial"
      } else {
        finalStatus = "returned"
      }
    }

    // Determinar status do material
    let materialStatus = "available"
    if (quantityReturned === 0) {
      // Extravio: material fica indisponível
      materialStatus = "unavailable"
    } else if (quantityReturned < quantityDelivered) {
      // Devolução parcial: material fica em manutenção até devolução completa
      materialStatus = "maintenance"
    }

    // Atualizar item
    const { error: updateError } = await supabase
      .from("cautela_items")
      .update({
        status: finalStatus === "partial" ? "returned" : finalStatus,
        quantity_returned: quantityReturned,
        returned_at: now,
        returned_by: operatorId,
        notes: item.notes || null
      })
      .eq("id", item.cautelaItemId)

    if (updateError) {
      return { success: false, error: `Erro ao processar item: ${updateError.message}` }
    }

    // Atualizar material
    await supabase
      .from("materials")
      .update({ status: materialStatus })
      .eq("id", cautelaItem.material_id)

    // Audit log
    await logAudit({
      action: "item_returned",
      entity: "cautela_items",
      entity_id: item.cautelaItemId,
      after_state: {
        status: finalStatus,
        quantity_delivered: quantityDelivered,
        quantity_returned: quantityReturned,
        material_id: cautelaItem.material_id,
        cautela_id: cautelaId
      },
    })

    processedCount++
  }

  // 6. Atualizar status da cautela
  const { data: updatedItems } = await supabase
    .from("cautela_items")
    .select("status, quantity_delivered, quantity_returned")
    .eq("cautela_id", cautelaId)

  const hasPartial = updatedItems?.some(i => i.status === "returned" && i.quantity_returned < i.quantity_delivered)
  const allDone = updatedItems?.every(i => i.status !== "pending")

  let cautelaStatus: "open" | "partial" | "closed" | "divergent" = "open"
  if (allDone) {
    cautelaStatus = hasPartial ? "divergent" : "closed"
  } else {
    cautelaStatus = "partial"
  }

  await supabase
    .from("cautelas")
    .update({
      status: cautelaStatus,
      closed_at: cautelaStatus === "closed" || cautelaStatus === "divergent" ? now : null
    })
    .eq("id", cautelaId)

  if (cautelaStatus === "closed" || cautelaStatus === "divergent") {
    const { data: operatorProfile } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("id", operatorId)
      .single()

    await logAudit({
      action: "cautela_closed",
      entity: "cautelas",
      entity_id: cautelaId,
      after_state: {
        status: cautelaStatus,
        closed_at: now,
        operator_id: operatorId,
        operator_name: operatorProfile?.name || operatorProfile?.email,
        bulk_devolution: true,
        items_total: updatedItems?.length,
      },
    })
  }

  revalidatePath("/cautelas")
  revalidatePath("/materials")

  return { success: true, processedCount }
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

// ===== BUSCAR MATERIAIS AGRUPADOS POR CATEGORIA =====
export async function getAvailableMaterialsGrouped() {
  const supabase = await createClient()

  // Buscar todas as categorias ordenadas
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .order("name")

  if (!categories) return []

  // Buscar materiais disponíveis
  const { data: materials } = await supabase
    .from("materials")
    .select("id, name, patrimony_number, serial_number, internal_code, category_id")
    .eq("status", "available")
    .order("name")

  if (!materials) return categories.map(c => ({ ...c, materials: [] }))

  // Agrupar materiais por categoria
  return categories.map(category => ({
    ...category,
    materials: materials.filter(m => m.category_id === category.id)
  }))
}

// ===== VERIFICAR CAUTELAS DIÁRIAS PENDENTES DE UMA PESSOA =====
// Regra: Apenas cautelas DIÁRIAS geram alerta de pendência
// Cautelas Permanentes NÃO geram alerta (não possuem prazo de devolução)
export async function getPendingCautelasForPerson(personId: string) {
  const idParsed = uuidSchema.safeParse(personId)
  if (!idParsed.success) return []

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("cautelas")
    .select(`
      id, type, status, created_at, notes,
      profiles(name),
      cautela_items(
        id, cautela_id, status,
        materials(name, patrimony_number)
      )
    `)
    .eq("person_id", personId)
    .eq("type", "daily")
    .in("status", ["open", "partial"])
    .order("created_at", { ascending: false })

  if (error) return []
  if (!data || data.length === 0) return []

  const vinteQuatroHorasAtras = new Date(Date.now() - 24 * 60 * 60 * 1000)

  return data.map((cautela) => {
    const rawItems = cautela.cautela_items || []
    const cautelaItems = rawItems.filter((i: { status: string }) => i.status === "pending")
    return {
      id: cautela.id,
      type: cautela.type,
      status: cautela.status,
      created_at: cautela.created_at,
      notes: cautela.notes,
      profiles: cautela.profiles,
      is_overdue: new Date(cautela.created_at) < vinteQuatroHorasAtras,
      items: cautelaItems,
      items_count: cautelaItems.length,
    }
  })
}

// ===== CRIAR CAUTELA COM VERIFICAÇÃO FACIAL (sem PIN) =====
export async function createCautelaFaceAuth(data: {
  person_id: string
  type: "daily" | "permanent"
  material_ids: string[]
  notes?: string
}) {
  const parsed = createCautelaFaceAuthInputSchema.safeParse(data)
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors
    const msg =
      (Object.values(first)[0] as string[] | undefined)?.[0] ||
      "Dados inválidos para abertura da cautela"
    return { error: msg }
  }

  const auth = await requireCautelaOperator()
  if ("error" in auth) return { error: auth.error }

  const supabase = await createClient()
  const payload = parsed.data

  const { data: materials, error: matError } = await supabase
    .from("materials")
    .select("id, name, status")
    .in("id", payload.material_ids)

  if (matError) return { error: matError.message }
  if (!materials || materials.length !== payload.material_ids.length) {
    return { error: "Um ou mais materiais não foram encontrados" }
  }

  const unavailable = materials.filter((m) => m.status !== "available")
  if (unavailable.length > 0) {
    return { error: formatUnavailableMaterialsMessage(unavailable) }
  }

  const { data: rpcDataFace, error: rpcErrorFace } = await supabase.rpc("create_cautela_atomic", {
    p_person_id: payload.person_id,
    p_type: payload.type,
    p_notes: payload.notes ?? null,
    p_material_ids: payload.material_ids,
  })

  if (rpcErrorFace) {
    return { error: mapCreateCautelaRpcError(rpcErrorFace.message) }
  }

  const resultFace = rpcDataFace as { cautela_id: string; cautela_item_ids?: string[] } | null
  const cautelaIdFace = resultFace?.cautela_id
  if (!cautelaIdFace) {
    return { error: "Falha ao criar cautela" }
  }

  await logAudit({
    action: "cautela_created",
    entity: "cautelas",
    entity_id: cautelaIdFace,
    after_state: {
      person_id: payload.person_id,
      type: payload.type,
      materials_count: payload.material_ids.length,
      material_ids: payload.material_ids,
      cautela_item_ids: resultFace?.cautela_item_ids ?? [],
      auth: "face",
    },
  })

  revalidatePath("/cautelas")
  revalidatePath("/materials")
  return { success: true, cautelaId: cautelaIdFace }
}

// ===== RENOVAR CAUTELA =====
export async function renewCautela(
  cautelaId: string,
  newExpirationDate?: string,
  notes?: string
) {
  const idParsed = uuidSchema.safeParse(cautelaId)
  if (!idParsed.success) {
    return { error: "Identificador de cautela inválido" }
  }

  const auth = await requireCautelaOperator()
  if ("error" in auth) return { error: auth.error }

  const supabase = await createClient()

  const { data: cautela, error: cautelaError } = await supabase
    .from("cautelas")
    .select("id, status, type, person_id")
    .eq("id", cautelaId)
    .single()

  if (cautelaError || !cautela) {
    return { error: "Cautela não encontrada" }
  }

  const mod = validateCautelaModifiable(cautela)
  if (!mod.valid) {
    return { error: mod.error }
  }

  const user = auth.user

  // 3. Calcular nova data de expiração (padrão: +30 dias)
  let expiresAt = newExpirationDate
  if (!expiresAt) {
    const newDate = new Date()
    newDate.setDate(newDate.getDate() + 30)
    expiresAt = newDate.toISOString()
  }

  // 4. Atualizar a cautela com nova expiração
  const { error: updateError } = await supabase
    .from("cautelas")
    .update({
      expires_at: expiresAt,
      renewed_at: new Date().toISOString(),
      renewed_by: user.id,
    })
    .eq("id", cautelaId)

  if (updateError) {
    return { error: "Erro ao renovar cautela: " + updateError.message }
  }

  // 5. Audit log
  await logAudit({
    action: "cautela_renewed",
    entity: "cautelas",
    entity_id: cautelaId,
    after_state: {
      expires_at: expiresAt,
      renewed_by: user.id,
      notes: notes || null
    },
  })

  revalidatePath("/cautelas")
  return { success: true, expiresAt }
}

// ===== CRIAR RENOVAÇÃO SIMPLES (com validação PIN) =====
export async function createSimpleCautelaRenewal(
  cautelaId: string,
  pin: string
) {
  const idParsed = uuidSchema.safeParse(cautelaId)
  if (!idParsed.success) {
    return { error: "Identificador de cautela inválido" }
  }

  const auth = await requireCautelaOperator()
  if ("error" in auth) return { error: auth.error }

  const supabase = await createClient()

  const { data: cautela, error: cautelaError } = await supabase
    .from("cautelas")
    .select("id, status, type, person_id, expires_at")
    .eq("id", cautelaId)
    .single()

  if (cautelaError || !cautela) {
    return { error: "Cautela não encontrada" }
  }

  const mod = validateCautelaModifiable(cautela)
  if (!mod.valid) {
    return { error: mod.error }
  }

  const pinResult = await validatePin(cautela.person_id, pin)
  if (!pinResult.valid) {
    return { error: pinResult.error }
  }

  const user = auth.user

  // 4. Calcular nova expiração
  const newExpiresAt = new Date()
  newExpiresAt.setDate(newExpiresAt.getDate() + 30)

  // 5. Atualizar cautela com nova expiração
  const { error: updateError } = await supabase
    .from("cautelas")
    .update({
      expires_at: newExpiresAt.toISOString(),
      renewed_at: new Date().toISOString(),
      renewed_by: user.id,
    })
    .eq("id", cautelaId)

  if (updateError) {
    return { error: "Erro ao renovar cautela: " + updateError.message }
  }

  // 6. Audit log
  await logAudit({
    action: "cautela_renewed",
    entity: "cautelas",
    entity_id: cautelaId,
    after_state: {
      expires_at: newExpiresAt.toISOString(),
      renewed_by: user.id,
    },
  })

  revalidatePath("/cautelas")
  return { success: true, expiresAt: newExpiresAt.toISOString() }
}

// ===== BUSCAR HISTÓRICO DE RENOVAÇÕES =====
export async function getCautelaRenewals(cautelaId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("cautela_renewals")
    .select(`
      *,
      profiles(name, email)
    `)
    .eq("cautela_id", cautelaId)
    .order("created_at", { ascending: false })

  if (error) return { error: error.message }
  return { renewals: data || [] }
}
