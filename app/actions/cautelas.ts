"use server"

import { createClient } from "@/lib/supabase-server"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"
import { logAudit } from "./audit"
import { requireCautelaOperator } from "@/lib/auth-cautela"
import {
  PIN_CHANGE_REQUIRED_MESSAGE,
  personRequiresPinChange,
} from "@/lib/person-pin-policy"
import {
  formatUnavailableMaterialsMessage,
  mergeCautelaItems,
  validateCautelaModifiable,
  type TransferOriginCautela,
  type TransferOriginItem,
} from "@/lib/cautela-helpers"
import {
  createCautelaFaceAuthInputSchema,
  createCautelaInputSchema,
  createCautelaWithTransferInputSchema,
  createCautelaWithTransferFaceAuthInputSchema,
  processBulkDevolutionInputSchema,
  uuidSchema,
} from "@/lib/cautela-schemas"
import { sendCautelaSummary } from "@/lib/whatsapp"
import {
  computeCautelaStatus,
  itemBalance,
  itemIsFullyReturned,
  itemNeedsReturn,
  qtyDelivered,
  qtyReturned,
  resolveItemStatusAfterReturn,
} from "@/lib/cautela-return-status"
import { generateCautelaPDF } from "@/lib/pdf-cautela"
import { extractCaliber } from "@/lib/cautela-caliber"
import {
  packAccessoryAvailabilityFilter,
  pickPackAccessoryForWeapon,
  type PackAccessoryCandidate,
  buildPackAccessoryPool,
  fetchReservablePackAccessories,
} from "@/lib/cautela-pack-accessories"
import { filterReservableMaterials } from "@/lib/cautela-reservable"
import { tagCautelaFlow } from "@/lib/sentry-flow"
import {
  countPoolChargersByStatus,
  isGlock9mmCharger,
  isGlock9mmPistol,
} from "@/lib/glock-9mm-inventory"
import {
  canReserveStock,
  effectiveStock,
  formatInsufficientStockMessage,
  resolveStockUnits,
} from "@/lib/material-stock"
import { sanitizeIlikeFragment } from "@/lib/search-sanitize"
import { Resend } from "resend"

async function assertCautelaOperator() {
  const auth = await requireCautelaOperator()
  if ("error" in auth) throw new Error(auth.error)
  return auth
}

async function dispatchCautelaNotifications(cautelaId: string) {
  try {
    const supabase = await createClient()
    const { data: cautela } = await supabase
      .from("cautelas")
      .select(`*, persons(full_name, rg, registration_number, function, phone, email), profiles(name, email), cautela_items(quantity_delivered, materials(name, patrimony_number, internal_code, category))`)
      .eq("id", cautelaId)
      .single()

    if (!cautela) return

    const person = cautela.persons as any
    const operator = cautela.profiles as any
    const items = (cautela.cautela_items as any[]) ?? []

    // 1. Generate PDF
    let pdfBuffer: Buffer | null = null
    try {
      pdfBuffer = await generateCautelaPDF({
        cautela: { id: cautela.id, type: cautela.type, status: cautela.status, created_at: cautela.created_at, notes: cautela.notes },
        person: { full_name: person?.full_name ?? "", rg: person?.rg ?? "", registration_number: person?.registration_number ?? "", function: person?.function },
        operator: { name: operator?.name ?? "", email: operator?.email ?? "" },
        items: items.map((i: any) => ({
          name: i.materials?.name ?? "",
          patrimony_number: i.materials?.patrimony_number ?? "",
          internal_code: i.materials?.internal_code ?? "",
          category: i.materials?.category,
          quantity_delivered: i.quantity_delivered ?? 1,
        })),
      })
    } catch (e) {
      console.error("[PDF] Erro ao gerar PDF da cautela:", e)
    }

    // 2. Send email with PDF attachment
    const resendKey = process.env.RESEND_API_KEY
    const archiveEmail = process.env.ARCHIVE_EMAIL
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"
    if (resendKey) {
      try {
        const resend = new Resend(resendKey)
        const recipients: string[] = []
        if (person?.email) recipients.push(person.email)
        if (archiveEmail) recipients.push(archiveEmail)
        if (recipients.length > 0) {
          const itemsList = items.map((i: any) => `• ${i.materials?.name} (Pat: ${i.materials?.patrimony_number})`).join("\n")
          const attachments = pdfBuffer
            ? [{ filename: `cautela-${cautelaId.slice(0, 8)}.pdf`, content: pdfBuffer.toString("base64") }]
            : []
          await resend.emails.send({
            from: fromEmail,
            to: recipients,
            subject: `Recibo de Cautela - ${new Date(cautela.created_at).toLocaleDateString("pt-BR")}`,
            text: `Olá ${person?.full_name},\n\nSua cautela foi registrada.\n\nTipo: ${cautela.type === "daily" ? "Diária" : "Permanente"}\nData: ${new Date(cautela.created_at).toLocaleString("pt-BR")}\nOperador: ${operator?.name}\n\nMateriais:\n${itemsList}\n\n${cautela.notes ? `Observações: ${cautela.notes}\n\n` : ""}Sistema RESERVA`,
            attachments,
          })
        }
      } catch (e) {
        console.error("[Email] Erro ao enviar email da cautela:", e)
      }
    }

    // 3. Send WhatsApp summary
    if (person?.phone) {
      await sendCautelaSummary({
        phone: person.phone,
        personName: person.full_name,
        operatorName: operator?.name ?? "Operador",
        type: cautela.type,
        date: cautela.created_at,
        items: items.map((i: any) => ({ name: i.materials?.name ?? "", quantity_delivered: i.quantity_delivered ?? 1 })),
      })
    }
  } catch (e) {
    console.error("[Notify] Erro nas notificações pós-cautela:", e)
  }
}

function mapCreateCautelaRpcError(message: string): string {
  if (message.includes("EMPTY_MATERIALS")) {
    return "Selecione pelo menos um material"
  }
  if (message.includes("MATERIALS_NOT_ALL_AVAILABLE")) {
    return "Um ou mais materiais não estão mais disponíveis. Atualize a lista e tente novamente."
  }
  if (message.includes("INSUFFICIENT_STOCK")) {
    return "Estoque insuficiente para um ou mais materiais. Reduza a quantidade ou atualize o cadastro."
  }
  if (message.includes("NOT_AUTHENTICATED")) {
    return "Sessão inválida. Faça login novamente."
  }
  return message
}

function resolveReviewDateForRpc(
  type: "daily" | "permanent",
  reviewDate?: string
): string | null {
  if (type !== "permanent") return null
  if (reviewDate) return new Date(reviewDate).toISOString()
  return null
}

function mapVistoriaRpcError(message: string): string {
  if (message.includes("NOT_PERMANENT_CAUTELA")) {
    return "Vistoria anual só se aplica a cautelas permanentes."
  }
  if (message.includes("CAUTELA_NOT_OPEN")) {
    return "A cautela não está aberta para vistoria."
  }
  if (message.includes("NO_PENDING_ITEMS")) {
    return "Não há itens pendentes para registrar vistoria."
  }
  if (message.includes("NOT_AUTHENTICATED")) {
    return "Sessão inválida. Faça login novamente."
  }
  return message
}

function validateCautelaItemsStock(
  merged: { material_id: string; quantity: number }[],
  materials: { id: string; name: string; status: string; stock_quantity: number | null }[]
): string | null {
  const byId = new Map(materials.map((m) => [m.id, m]))
  for (const item of merged) {
    const m = byId.get(item.material_id)
    if (!m) continue
    if (!canReserveStock(m, item.quantity)) {
      return formatInsufficientStockMessage(m, item.quantity, effectiveStock(m))
    }
  }
  return null
}

async function restoreMaterialStockAfterReturn(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cautelaItemId: string,
  previousReturned: number,
  newReturned: number,
  itemStatus: "pending" | "returned" | "damaged" | "missing",
  qtyDelivered: number
) {
  const { error } = await supabase.rpc("registrar_movimentacao_devolucao", {
    p_cautela_item_id: cautelaItemId,
    p_previous_returned: previousReturned,
    p_new_returned: newReturned,
    p_item_status: itemStatus,
    p_qty_delivered: qtyDelivered,
  })

  if (error) throw new Error(error.message)
}

// ===== LISTAR CAUTELAS =====
export async function getCautelas(filters?: { status?: string; search?: string }) {
  await assertCautelaOperator()
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
      const withBalance = cautelaItems.filter((i) => itemNeedsReturn(i))
      return {
        ...cautela,
        items_count: cautelaItems.length,
        items_returned: cautelaItems.filter((i) => itemIsFullyReturned(i)).length,
        items_pending: cautelaItems.filter((i) => i.status === "pending").length,
        items_with_balance: withBalance.length,
      }
    })
  }

  return data || []
}

// ===== DETALHES DE UMA CAUTELA =====
export async function getCautelaById(id: string) {
  await assertCautelaOperator()
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
      materials(id, name, patrimony_number, serial_number, internal_code, category)
    `)
    .eq("cautela_id", id)

  return { cautela, items: items || [] }
}

async function assertPersonEligibleForCautela(
  supabase: Awaited<ReturnType<typeof createClient>>,
  personId: string
): Promise<{ error?: string }> {
  const { data: person, error } = await supabase
    .from("persons")
    .select("pin_hash, must_change_pin")
    .eq("id", personId)
    .single()

  if (error || !person) return { error: "Pessoa não encontrada" }
  if (await personRequiresPinChange(person)) {
    return { error: PIN_CHANGE_REQUIRED_MESSAGE }
  }
  return {}
}

// ===== VALIDAR PIN =====
export async function validatePin(personId: string, pin: string) {
  const auth = await requireCautelaOperator()
  if ("error" in auth) return { valid: false, error: auth.error }

  const supabase = await createClient()

  const { data: person, error } = await supabase
    .from("persons")
    .select("id, pin_hash, must_change_pin, failed_pin_attempts, pin_locked_until")
    .eq("id", personId)
    .single()

  if (error || !person) return { valid: false, error: "Pessoa não encontrada" }

  if (await personRequiresPinChange(person)) {
    return { valid: false, error: PIN_CHANGE_REQUIRED_MESSAGE }
  }

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
  items: { material_id: string; quantity?: number }[]
  notes?: string
  pin: string
  review_date?: string
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
  const merged = mergeCautelaItems(payload.items)
  const distinctIds = merged.map((m) => m.material_id)

  const pinPolicy = await assertPersonEligibleForCautela(supabase, payload.person_id)
  if (pinPolicy.error) return { error: pinPolicy.error }

  const pinResult = await validatePin(payload.person_id, payload.pin)
  if (!pinResult.valid) return { error: pinResult.error }

  const { data: materials, error: matError } = await supabase
    .from("materials")
    .select("id, name, status, status_atual, stock_quantity")
    .in("id", distinctIds)

  if (matError) return { error: matError.message }
  if (!materials || materials.length !== distinctIds.length) {
    return { error: "Um ou mais materiais não foram encontrados" }
  }

  const unavailable = materials.filter((m) => m.status !== "available")
  if (unavailable.length > 0) {
    return { error: formatUnavailableMaterialsMessage(unavailable) }
  }

  const stockError = validateCautelaItemsStock(merged, materials)
  if (stockError) return { error: stockError }

  const { data: rpcData, error: rpcError } = await supabase.rpc("create_cautela_atomic", {
    p_person_id: payload.person_id,
    p_type: payload.type,
    p_notes: payload.notes ?? null,
    p_items: merged,
    p_review_date: resolveReviewDateForRpc(payload.type, data.review_date),
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
      materials_count: merged.length,
      items: merged,
      cautela_item_ids: result?.cautela_item_ids ?? [],
    },
  })

  // Disparar notificações (email + WhatsApp) sem bloquear o retorno
  dispatchCautelaNotifications(cautelaId).catch(console.error)

  tagCautelaFlow("cautela_create", cautelaId)

  revalidatePath("/cautelas")
  revalidatePath("/materials")
  return { success: true, cautelaId }
}

async function syncCautelaStatusFromItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cautelaId: string,
  operatorId: string,
  now: string
) {
  const { data: updatedItems } = await supabase
    .from("cautela_items")
    .select("status, quantity_delivered, quantity_returned")
    .eq("cautela_id", cautelaId)

  const rows = updatedItems || []
  const cautelaStatus = computeCautelaStatus(rows)
  const closedAt = cautelaStatus === "closed" || cautelaStatus === "divergent" ? now : null

  await supabase
    .from("cautelas")
    .update({ status: cautelaStatus, closed_at: closedAt })
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
        closed_at: closedAt,
        operator_id: operatorId,
        operator_name: operatorProfile?.name || operatorProfile?.email,
        items_total: rows.length,
      },
    })
  }
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
    .select("id, material_id, cautela_id, status, quantity_delivered, quantity_returned")
    .eq("id", cautelaItemId)
    .single()

  if (itemError || !item) return { error: "Item não encontrado" }
  if (!itemNeedsReturn(item)) {
    return { error: "Este item já foi processado ou não possui saldo pendente" }
  }

  const delivered = qtyDelivered(item)
  const now = new Date().toISOString()

  let itemStatus: "pending" | "returned" | "damaged" | "missing" = status
  let qtyReturn = 0

  if (status === "damaged" || status === "missing") {
    qtyReturn = 0
  } else {
    qtyReturn = quantityReturned ?? delivered
    const previousReturned = qtyReturned(item)
    if (qtyReturn < previousReturned) {
      return {
        error: `Quantidade devolvida não pode ser menor que o já registrado (${previousReturned})`,
      }
    }
    if (qtyReturn < 0 || qtyReturn > delivered) {
      return { error: `Quantidade inválida. Deve estar entre 0 e ${delivered}` }
    }
    itemStatus = resolveItemStatusAfterReturn(qtyReturn, delivered)
  }

  const { error: updateItemError } = await supabase
    .from("cautela_items")
    .update({
      status: itemStatus,
      notes: notes || null,
      quantity_returned: qtyReturn,
      returned_at: now,
      returned_by: operatorId,
    })
    .eq("id", cautelaItemId)

  if (updateItemError) return { error: updateItemError.message }

  const previousReturned = qtyReturned(item)
  await restoreMaterialStockAfterReturn(
    supabase,
    cautelaItemId,
    previousReturned,
    qtyReturn,
    itemStatus,
    delivered
  )

  await syncCautelaStatusFromItems(supabase, item.cautela_id, operatorId, now)

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
  confirmed?: boolean
  quantityReturned?: number
  notes?: string
  disposition?: "return" | "damaged" | "missing"
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

  const { data: allCautelaItems, error: itemsError } = await supabase
    .from("cautela_items")
    .select(`
      id, material_id, status, quantity_delivered, quantity_returned,
      materials(name, patrimony_number)
    `)
    .eq("cautela_id", cautelaId)

  if (itemsError) return { success: false, error: itemsError.message }

  const actionableItems = (allCautelaItems || []).filter((i) => itemNeedsReturn(i))
  if (actionableItems.length === 0) {
    return { success: false, error: "Nenhum item com saldo pendente nesta cautela" }
  }

  const actionableIds = actionableItems.map((i) => i.id)
  const processedIds = items.map((i) => i.cautelaItemId)
  const unprocessedItems = actionableIds.filter((id) => !processedIds.includes(id))

  if (unprocessedItems.length > 0) {
    const unprocessedNames = actionableItems
      .filter((i) => unprocessedItems.includes(i.id))
      .map((i) => {
        const m = i.materials as { name?: string; patrimony_number?: string } | null
        return m?.name || m?.patrimony_number || "Item"
      })
    return {
      success: false,
      error: `Existem itens que não foram conferidos: ${unprocessedNames.join(", ")}`,
      pendingItems: unprocessedItems,
    }
  }

  const materialName = (ci: (typeof allCautelaItems)[0]) => {
    const m = ci?.materials as { name?: string; patrimony_number?: string } | null
    return m?.name || m?.patrimony_number || "Item"
  }

  for (const item of items) {
    const cautelaItem = allCautelaItems?.find((ci) => ci.id === item.cautelaItemId)
    if (!cautelaItem) {
      return { success: false, error: `Item ${item.cautelaItemId} não encontrado` }
    }

    const delivered = qtyDelivered(cautelaItem)
    const disposition = item.disposition ?? "return"

    if (disposition === "damaged" || disposition === "missing") {
      if (!item.notes?.trim()) {
        return {
          success: false,
          error: `Justificativa obrigatória para "${materialName(cautelaItem)}"`,
        }
      }
      continue
    }

    if (!item.confirmed && (item.quantityReturned === undefined || item.quantityReturned === null)) {
      return {
        success: false,
        error: `Item "${materialName(cautelaItem)}" não possui devolução total nem quantidade informada`,
      }
    }

    const totalReturned = item.confirmed ? delivered : (item.quantityReturned as number)
    if (totalReturned < qtyReturned(cautelaItem)) {
      return {
        success: false,
        error: `Quantidade devolvida não pode ser menor que o já registrado em "${materialName(cautelaItem)}"`,
      }
    }
    if (totalReturned < 0 || totalReturned > delivered) {
      return {
        success: false,
        error: `Quantidade inválida para "${materialName(cautelaItem)}" (0 a ${delivered})`,
      }
    }
  }

  const now = new Date().toISOString()
  let processedCount = 0

  for (const item of items) {
    const cautelaItem = allCautelaItems!.find((ci) => ci.id === item.cautelaItemId)!
    const delivered = qtyDelivered(cautelaItem)
    const disposition = item.disposition ?? "return"

    if (disposition === "damaged" || disposition === "missing") {
      const { error: updateError } = await supabase
        .from("cautela_items")
        .update({
          status: disposition,
          quantity_returned: 0,
          returned_at: now,
          returned_by: operatorId,
          notes: item.notes || null,
        })
        .eq("id", item.cautelaItemId)

      if (updateError) {
        return { success: false, error: `Erro ao processar item: ${updateError.message}` }
      }

      await restoreMaterialStockAfterReturn(
        supabase,
        item.cautelaItemId,
        qtyReturned(cautelaItem),
        0,
        disposition,
        delivered
      )

      await logAudit({
        action: disposition === "damaged" ? "item_damaged" : "item_missing",
        entity: "cautela_items",
        entity_id: item.cautelaItemId,
        after_state: { status: disposition, cautela_id: cautelaId },
      })
      processedCount++
      continue
    }

    const totalReturned = item.confirmed ? delivered : (item.quantityReturned as number)
    const newStatus = resolveItemStatusAfterReturn(totalReturned, delivered)
    const prevReturned = qtyReturned(cautelaItem)

    const { error: updateError } = await supabase
      .from("cautela_items")
      .update({
        status: newStatus,
        quantity_returned: totalReturned,
        returned_at: now,
        returned_by: operatorId,
        notes: item.notes || null,
      })
      .eq("id", item.cautelaItemId)

    if (updateError) {
      return { success: false, error: `Erro ao processar item: ${updateError.message}` }
    }

    await restoreMaterialStockAfterReturn(
      supabase,
      item.cautelaItemId,
      prevReturned,
      totalReturned,
      newStatus,
      delivered
    )

    await logAudit({
      action: "item_returned",
      entity: "cautela_items",
      entity_id: item.cautelaItemId,
      after_state: {
        status: newStatus,
        quantity_delivered: delivered,
        quantity_returned: totalReturned,
        balance: delivered - totalReturned,
        material_id: cautelaItem.material_id,
        cautela_id: cautelaId,
      },
    })

    processedCount++
  }

  await syncCautelaStatusFromItems(supabase, cautelaId, operatorId, now)

  revalidatePath("/cautelas")
  revalidatePath("/materials")

  return { success: true, processedCount }
}

// ===== BUSCAR PESSOAS (para autocomplete no wizard) =====
export async function searchPersons(query: string) {
  await assertCautelaOperator()
  const q = sanitizeIlikeFragment(query.trim(), 80)
  if (q.length < 2) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("persons")
    .select(
      "id, full_name, rg, registration_number, function, status, rg_front_url, rg_back_url, face_descriptor, pin_hash"
    )
    .eq("status", "active")
    .or(`full_name.ilike.%${q}%,rg.ilike.%${q}%,registration_number.ilike.%${q}%`)
    .limit(10)

  if (error) return []
  return (data ?? []).map(({ pin_hash, ...person }) => ({
    ...person,
    has_registered_pin: typeof pin_hash === "string" && pin_hash.length > 0,
  }))
}

// ===== BUSCAR MATERIAIS DISPONÍVEIS =====
export async function getAvailableMaterials(categoryName?: string) {
  await assertCautelaOperator()
  const supabase = await createClient()
  let query = supabase
    .from("materials")
    .select("id, name, patrimony_number, serial_number, internal_code, category, stock_quantity, status, status_atual")
    .eq("status_atual", "DISPONIVEL")
    .order("name")

  if (categoryName) {
    query = query.eq("category", categoryName)
  }

  const { data, error } = await query
  if (error) return []
  return filterReservableMaterials(data ?? [], undefined)
}

// ===== BUSCAR MATERIAIS AGRUPADOS POR CATEGORIA =====
export async function getAvailableMaterialsGrouped() {
  await assertCautelaOperator()
  const supabase = await createClient()

  const { data: materials } = await supabase
    .from("materials")
    .select("id, name, patrimony_number, serial_number, internal_code, category, stock_quantity, status, status_atual")
    .eq("status_atual", "DISPONIVEL")
    .order("name")

  const reservable = filterReservableMaterials(materials ?? [], undefined)
  if (!reservable.length) return []

  const byName = new Map<string, typeof reservable>()
  for (const m of reservable) {
    const key = m.category || "Geral"
    const arr = byName.get(key) ?? []
    arr.push(m)
    byName.set(key, arr)
  }

  return Array.from(byName.entries())
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
    .map(([name, mats]) => ({ name, materials: mats }))
}

export type SearchableMaterial = {
  id: string
  name: string
  patrimony_number: string
  serial_number: string | null
  internal_code: string
  category: string
  stock_quantity?: number
}

/** Busca materiais disponíveis por nome, patrimônio, serial, código interno ou UUID. */
export async function searchMaterials(
  query: string,
  categoryNames?: string[]
): Promise<SearchableMaterial[]> {
  await assertCautelaOperator()
  const raw = query.trim()
  if (raw.length < 1) return []

  const supabase = await createClient()
  const select = "id, name, patrimony_number, serial_number, internal_code, category, stock_quantity, status, status_atual"

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  if (uuidPattern.test(raw)) {
    let qUuid = supabase.from("materials").select(select).eq("status_atual", "DISPONIVEL").eq("id", raw).limit(5)
    if (categoryNames && categoryNames.length > 0) {
      qUuid = qUuid.in("category", categoryNames)
    }
    const { data } = await qUuid
    return filterReservableMaterials((data ?? []) as SearchableMaterial[], undefined)
  }

  const q = sanitizeIlikeFragment(raw, 80)
  if (q.length < 1) return []

  let qText = supabase
    .from("materials")
    .select(select)
    .eq("status_atual", "DISPONIVEL")
    .or(`name.ilike.%${q}%,patrimony_number.ilike.%${q}%,serial_number.ilike.%${q}%,internal_code.ilike.%${q}%`)
    .limit(25)

  if (categoryNames && categoryNames.length > 0) {
    qText = qText.in("category", categoryNames)
  }

  const { data, error } = await qText

  if (error) return []
  return filterReservableMaterials((data ?? []) as SearchableMaterial[], undefined)
}

/** Resolve carregador ou munição disponível compatível com a arma (pacote pistola/arma longa). */
export async function resolvePackAccessoryForWeapon(
  weaponId: string,
  kind: "charger" | "ammunition"
): Promise<{ material: SearchableMaterial | null; error?: string }> {
  await assertCautelaOperator()
  const multi = await resolvePackAccessoriesForWeapon(weaponId, kind, 1)
  if (multi.error) return { material: null, error: multi.error }
  return { material: multi.materials[0] ?? null }
}

function toSearchableMaterial(m: PackAccessoryCandidate): SearchableMaterial {
  return {
    id: m.id,
    name: m.name,
    patrimony_number: m.patrimony_number ?? "",
    serial_number: m.serial_number,
    internal_code: m.internal_code ?? "",
    category: m.category ?? "",
    stock_quantity: m.stock_quantity ?? 1,
  }
}

/** Valida quantidade pedida contra estoque disponível (Nova Cautela, antes de gravar). */
export async function validateMaterialQuantityForCautela(
  materialId: string,
  quantity: number
): Promise<{ ok: true; stock: number } | { ok: false; error: string }> {
  await assertCautelaOperator()
  const idParsed = uuidSchema.safeParse(materialId)
  if (!idParsed.success) return { ok: false, error: "Material inválido" }

  const qty = Math.max(1, Math.floor(quantity))
  const supabase = await createClient()
  const { data: material, error } = await supabase
    .from("materials")
    .select("id, name, status, status_atual, stock_quantity")
    .eq("id", materialId)
    .single()

  if (error || !material) return { ok: false, error: "Material não encontrado" }
  if (!canReserveStock(material, qty)) {
    return {
      ok: false,
      error: formatInsufficientStockMessage(material, qty, effectiveStock(material)),
    }
  }
  return { ok: true, stock: effectiveStock(material) }
}

/** Carregadores Glock 9mm do pool QA com status available (qty livre na Nova Cautela). */
export async function countAvailableGlock9mmChargers(): Promise<number> {
  await assertCautelaOperator()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("materials")
    .select("id, name, category, calibre, marca, patrimony_number, status, status_atual")
    .eq("status_atual", "DISPONIVEL")
    .or(packAccessoryAvailabilityFilter("charger"))
    .limit(500)

  if (error) return 0
  return (data ?? []).filter((m) => isGlock9mmCharger(m)).length
}

function weaponCaliberLabel(weapon: {
  name: string
  category: string
  calibre?: string | null
}): string | null {
  const fromField = weapon.calibre?.trim()
  if (fromField) return fromField
  return extractCaliber(weapon.name) || extractCaliber(weapon.category)
}

/**
 * Resolve até `count` acessórios distintos do estoque available.
 * Pool Glock 9mm só para pistola Glock 9mm; demais armas por marca/modelo/calibre.
 */
export async function resolvePackAccessoriesForWeapon(
  weaponId: string,
  kind: "charger" | "ammunition",
  count: number
): Promise<{ materials: SearchableMaterial[]; error?: string }> {
  await assertCautelaOperator()
  if (count < 1) return { materials: [] }

  const idParsed = uuidSchema.safeParse(weaponId)
  if (!idParsed.success) {
    return { materials: [], error: "Arma inválida" }
  }

  const supabase = await createClient()
  const { data: weapon, error: weaponError } = await supabase
    .from("materials")
    .select("id, name, category, calibre, marca, modelo")
    .eq("id", weaponId)
    .single()

  if (weaponError || !weapon) {
    return { materials: [], error: "Arma não encontrada" }
  }

  let candidates: PackAccessoryCandidate[]
  try {
    candidates = await fetchReservablePackAccessories(supabase, kind)
  } catch (listError) {
    const msg = listError instanceof Error ? listError.message : "Erro ao listar acessórios"
    return { materials: [], error: msg }
  }

  const useGlockPool = isGlock9mmPistol(weapon) && kind === "charger"
  const poolCandidates = buildPackAccessoryPool(weapon, candidates, kind)

  const resolved = resolveStockUnits(poolCandidates, count, (pool) => {
    return pickPackAccessoryForWeapon(weapon, pool, kind)
  })

  if (resolved.error || resolved.items.length < count) {
    const label = kind === "charger" ? "carregador" : "munição"
    const cal = weaponCaliberLabel(weapon)
    const calPart = cal ? ` (calibre ${cal})` : ""
    if (resolved.error) {
      return { materials: [], error: resolved.error }
    }
    if (kind === "charger" && useGlockPool) {
      const stats = countPoolChargersByStatus(poolCandidates)
      return {
        materials: [],
        error: `Precisa de ${count} ${label}(es) no pool; encontrados ${resolved.items.length} (pool: ${stats.available} livre(s)).`,
      }
    }
    return {
      materials: [],
      error:
        resolved.items.length === 0
          ? `Nenhum ${label} disponível para ${weapon.name}${calPart}.`
          : `Precisa de ${count} ${label}(es) compatível(is) com ${weapon.name}${calPart}; em estoque: ${resolved.items[0] ? effectiveStock(resolved.items[0]) : 0}.`,
    }
  }

  return { materials: resolved.items.map(toSearchableMaterial) }
}

// ===== BUSCAR CAUTELA DIÁRIA DE ORIGEM PARA TRANSFERÊNCIA =====
export async function getDailyCautelaForMaterial(materialId: string): Promise<{
  origin: TransferOriginCautela | null
  error?: string
  permanentBlock?: boolean
}> {
  await assertCautelaOperator()
  const idParsed = uuidSchema.safeParse(materialId)
  if (!idParsed.success) return { origin: null, error: "Material inválido" }

  const supabase = await createClient()

  const { data: material, error: matError } = await supabase
    .from("materials")
    .select("id, status, status_atual")
    .eq("id", materialId)
    .single()

  if (matError || !material) return { origin: null, error: "Material não encontrado" }

  const { data: activeItem, error: itemError } = await supabase
    .from("cautela_items")
    .select(`
      id, cautela_id, material_id, status, quantity_delivered, quantity_returned,
      materials(id, name, patrimony_number, category)
    `)
    .eq("material_id", materialId)
    .in("status", ["pending"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (itemError || !activeItem) return { origin: null }

  const { data: cautela, error: cautelaError } = await supabase
    .from("cautelas")
    .select(`id, person_id, type, status, persons(id, full_name)`)
    .eq("id", activeItem.cautela_id)
    .single()

  if (cautelaError || !cautela) return { origin: null }

  if (cautela.type === "permanent") {
    return { origin: null, permanentBlock: true }
  }

  if (cautela.type !== "daily" || !["open", "partial"].includes(cautela.status)) {
    return { origin: null }
  }

  const { data: siblingItems } = await supabase
    .from("cautela_items")
    .select(`
      id, material_id, status, quantity_delivered, quantity_returned,
      materials(id, name, patrimony_number, category)
    `)
    .eq("cautela_id", cautela.id)

  const person = cautela.persons as any
  const transferItems: TransferOriginItem[] = (siblingItems || [])
    .filter((i: any) => i.status === "pending" && (i.quantity_delivered - (i.quantity_returned || 0)) > 0)
    .map((i: any) => ({
      cautela_item_id: i.id,
      material_id: i.material_id,
      material_name: i.materials?.name ?? "",
      patrimony_number: i.materials?.patrimony_number ?? "",
      quantity_delivered: i.quantity_delivered ?? 1,
      quantity_returned: i.quantity_returned ?? 0,
      quantity_available: (i.quantity_delivered ?? 1) - (i.quantity_returned ?? 0),
      category: i.materials?.category ?? "",
    }))

  return {
    origin: {
      cautela_id: cautela.id,
      person_id: cautela.person_id,
      person_name: person?.full_name ?? "",
      type: cautela.type,
      status: cautela.status,
      items: transferItems,
    },
  }
}

// ===== VERIFICAR CAUTELAS DIÁRIAS PENDENTES DE UMA PESSOA =====
// Regra: Apenas cautelas DIÁRIAS geram alerta de pendência
// Cautelas Permanentes NÃO geram alerta (não possuem prazo de devolução)
export async function getPendingCautelasForPerson(personId: string) {
  await assertCautelaOperator()
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
  items: { material_id: string; quantity?: number }[]
  notes?: string
  review_date?: string
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
  const merged = mergeCautelaItems(payload.items)
  const distinctIds = merged.map((m) => m.material_id)

  const pinPolicyFace = await assertPersonEligibleForCautela(supabase, payload.person_id)
  if (pinPolicyFace.error) return { error: pinPolicyFace.error }

  const { data: materials, error: matError } = await supabase
    .from("materials")
    .select("id, name, status, status_atual, stock_quantity")
    .in("id", distinctIds)

  if (matError) return { error: matError.message }
  if (!materials || materials.length !== distinctIds.length) {
    return { error: "Um ou mais materiais não foram encontrados" }
  }

  const unavailable = materials.filter((m) => m.status !== "available")
  if (unavailable.length > 0) {
    return { error: formatUnavailableMaterialsMessage(unavailable) }
  }

  const stockErrorFace = validateCautelaItemsStock(merged, materials)
  if (stockErrorFace) return { error: stockErrorFace }

  const { data: rpcDataFace, error: rpcErrorFace } = await supabase.rpc("create_cautela_atomic", {
    p_person_id: payload.person_id,
    p_type: payload.type,
    p_notes: payload.notes ?? null,
    p_items: merged,
    p_review_date: resolveReviewDateForRpc(payload.type, data.review_date),
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
      materials_count: merged.length,
      items: merged,
      cautela_item_ids: resultFace?.cautela_item_ids ?? [],
      auth: "face",
    },
  })

  // Disparar notificações (email + WhatsApp) sem bloquear o retorno
  dispatchCautelaNotifications(cautelaIdFace).catch(console.error)

  revalidatePath("/cautelas")
  revalidatePath("/materials")
  return { success: true, cautelaId: cautelaIdFace }
}

// ===== CRIAR CAUTELA COM TRANSFERÊNCIA (PIN) =====
export async function createCautelaWithTransfer(data: {
  person_id: string
  type: "daily"
  items: { material_id: string; quantity: number; transfer_from_cautela_item_id?: string }[]
  notes?: string
  pin: string
}) {
  const parsed = createCautelaWithTransferInputSchema.safeParse(data)
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors
    const msg =
      (Object.values(first)[0] as string[] | undefined)?.[0] ||
      "Dados inválidos para abertura da cautela com transferência"
    return { error: msg }
  }

  const auth = await requireCautelaOperator()
  if ("error" in auth) return { error: auth.error }

  const supabase = await createClient()
  const payload = parsed.data
  const operatorId = auth.user.id

  const pinPolicy = await assertPersonEligibleForCautela(supabase, payload.person_id)
  if (pinPolicy.error) return { error: pinPolicy.error }

  const pinResult = await validatePin(payload.person_id, payload.pin)
  if (!pinResult.valid) return { error: pinResult.error }

  const transferItems = payload.items.filter((i) => i.transfer_from_cautela_item_id)
  const availableItems = payload.items.filter((i) => !i.transfer_from_cautela_item_id)

  for (const ti of transferItems) {
    const { data: originItem, error: originError } = await supabase
      .from("cautela_items")
      .select(`id, cautela_id, material_id, status, quantity_delivered, quantity_returned, cautelas(person_id, type)`)
      .eq("id", ti.transfer_from_cautela_item_id)
      .single()

    if (originError || !originItem) return { error: "Item de origem não encontrado" }

    const originCautela = originItem.cautelas as any
    if (originCautela?.type === "permanent") {
      return { error: "Transferência não permitida para materiais em cautela Permanente" }
    }
    if (originCautela?.person_id === payload.person_id) {
      return { error: "Origem e destino não podem ser a mesma pessoa" }
    }
    const balance = (originItem.quantity_delivered || 1) - (originItem.quantity_returned || 0)
    if (ti.quantity > balance) {
      return { error: `Quantidade transferida (${ti.quantity}) excede saldo disponível (${balance})` }
    }
  }

  if (availableItems.length > 0) {
    const distinctIds = availableItems.map((m) => m.material_id)
    const { data: materials, error: matError } = await supabase
      .from("materials")
      .select("id, name, status, status_atual, stock_quantity")
      .in("id", distinctIds)

    if (matError) return { error: matError.message }
    if (!materials || materials.length !== distinctIds.length) {
      return { error: "Um ou mais materiais não foram encontrados" }
    }

    const unavailable = materials.filter((m) => m.status !== "available")
    if (unavailable.length > 0) {
      return { error: formatUnavailableMaterialsMessage(unavailable) }
    }

    const merged = mergeCautelaItems(availableItems)
    const stockErr = validateCautelaItemsStock(merged, materials)
    if (stockErr) return { error: stockErr }
  }

  const now = new Date().toISOString()
  const { data: deadlineData } = await supabase.rpc("calc_daily_return_deadline")
  const deadline = deadlineData as string | null

  const { data: tenantData } = await supabase
    .from("usuarios")
    .select("organization_id, unit_id, reserva_id")
    .eq("auth_user_id", operatorId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()

  const tenant = tenantData as { organization_id: string; unit_id: string; reserva_id: string } | null

  const { data: newCautela, error: createError } = await supabase
    .from("cautelas")
    .insert({
      person_id: payload.person_id,
      operator_id: operatorId,
      type: "daily",
      status: "open",
      notes: payload.notes ?? null,
      data_prevista_devolucao: deadline,
      organization_id: tenant?.organization_id ?? null,
      unit_id: tenant?.unit_id ?? null,
      reserva_id: tenant?.reserva_id ?? null,
    })
    .select("id")
    .single()

  if (createError) return { error: createError.message }
  const newCautelaId = (newCautela as any).id

  for (const ti of transferItems) {
    const { data: originItem } = await supabase
      .from("cautela_items")
      .select("id, cautela_id, material_id, quantity_delivered, quantity_returned, status")
      .eq("id", ti.transfer_from_cautela_item_id)
      .single()

    if (!originItem) continue

    const prevReturned = originItem.quantity_returned || 0
    const newReturned = prevReturned + ti.quantity
    const delivered = originItem.quantity_delivered || 1
    const itemStatus: "pending" | "returned" = newReturned >= delivered ? "returned" : "pending"

    await supabase
      .from("cautela_items")
      .update({
        quantity_returned: newReturned,
        status: itemStatus,
        returned_at: itemStatus === "returned" ? now : null,
        returned_by: itemStatus === "returned" ? operatorId : null,
      })
      .eq("id", ti.transfer_from_cautela_item_id)

    await supabase
      .from("cautela_items")
      .insert({
        cautela_id: newCautelaId,
        material_id: ti.material_id,
        status: "pending",
        quantity_delivered: ti.quantity,
        organization_id: tenant?.organization_id ?? null,
        unit_id: tenant?.unit_id ?? null,
        reserva_id: tenant?.reserva_id ?? null,
      })

    await syncCautelaStatusFromItems(supabase, originItem.cautela_id, operatorId, now)

    await logAudit({
      action: "item_transferred",
      entity: "cautela_items",
      entity_id: ti.transfer_from_cautela_item_id!,
      before_state: {
        cautela_id: originItem.cautela_id,
        material_id: ti.material_id,
        status: originItem.status,
        quantity_returned: prevReturned,
      },
      after_state: {
        cautela_id_destino: newCautelaId,
        material_id: ti.material_id,
        status: itemStatus,
        quantity_returned: newReturned,
        quantity_transferred: ti.quantity,
      },
    })
  }

  if (availableItems.length === 0) {
    await logAudit({
      action: "cautela_created",
      entity: "cautelas",
      entity_id: newCautelaId,
      after_state: {
        person_id: payload.person_id,
        type: "daily",
        materials_count: transferItems.length,
        items: transferItems.map((ti) => ({ material_id: ti.material_id, quantity: ti.quantity })),
        transfer_count: transferItems.length,
        transfer_only: true,
      },
    })
  } else {
    const merged = mergeCautelaItems(availableItems)

    for (const item of merged) {
      const { data: matItem } = await supabase
        .from("materials")
        .select("id, name, stock_quantity")
        .eq("id", item.material_id)
        .single()

      if (!matItem) continue

      await supabase
        .from("cautela_items")
        .insert({
          cautela_id: newCautelaId,
          material_id: item.material_id,
          status: "pending",
          quantity_delivered: item.quantity,
          organization_id: tenant?.organization_id ?? null,
          unit_id: tenant?.unit_id ?? null,
          reserva_id: tenant?.reserva_id ?? null,
        })

      const newStock = Math.max(0, (matItem.stock_quantity ?? 1) - item.quantity)
      const newMatStatus = newStock <= 0 ? "cautelado" : "available"
      await supabase
        .from("materials")
        .update({ stock_quantity: newStock, status: newMatStatus, updated_at: now })
        .eq("id", item.material_id)
    }

    await logAudit({
      action: "cautela_created",
      entity: "cautelas",
      entity_id: newCautelaId,
      after_state: {
        person_id: payload.person_id,
        type: "daily",
        materials_count: merged.length,
        items: merged,
        transfer_count: transferItems.length,
      },
    })
  }

  await dispatchCautelaNotifications(newCautelaId).catch(console.error)
  await dispatchTransferNotifications(newCautelaId, transferItems).catch(console.error)

  revalidatePath("/cautelas")
  revalidatePath("/materials")
  return { success: true, cautelaId: newCautelaId }
}

// ===== CRIAR CAUTELA COM TRANSFERÊNCIA (VERIFICAÇÃO FACIAL) =====
export async function createCautelaWithTransferFaceAuth(data: {
  person_id: string
  type: "daily"
  items: { material_id: string; quantity: number; transfer_from_cautela_item_id?: string }[]
  notes?: string
}) {
  const parsed = createCautelaWithTransferFaceAuthInputSchema.safeParse(data)
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors
    const msg =
      (Object.values(first)[0] as string[] | undefined)?.[0] ||
      "Dados inválidos para abertura da cautela com transferência"
    return { error: msg }
  }

  const auth = await requireCautelaOperator()
  if ("error" in auth) return { error: auth.error }

  const supabase = await createClient()
  const payload = parsed.data
  const operatorId = auth.user.id

  const pinPolicy = await assertPersonEligibleForCautela(supabase, payload.person_id)
  if (pinPolicy.error) return { error: pinPolicy.error }

  const transferItems = payload.items.filter((i) => i.transfer_from_cautela_item_id)
  const availableItems = payload.items.filter((i) => !i.transfer_from_cautela_item_id)

  for (const ti of transferItems) {
    const { data: originItem, error: originError } = await supabase
      .from("cautela_items")
      .select(`id, cautela_id, material_id, status, quantity_delivered, quantity_returned, cautelas(person_id, type)`)
      .eq("id", ti.transfer_from_cautela_item_id)
      .single()

    if (originError || !originItem) return { error: "Item de origem não encontrado" }

    const originCautela = originItem.cautelas as any
    if (originCautela?.type === "permanent") {
      return { error: "Transferência não permitida para materiais em cautela Permanente" }
    }
    if (originCautela?.person_id === payload.person_id) {
      return { error: "Origem e destino não podem ser a mesma pessoa" }
    }
    const balance = (originItem.quantity_delivered || 1) - (originItem.quantity_returned || 0)
    if (ti.quantity > balance) {
      return { error: `Quantidade transferida (${ti.quantity}) excede saldo disponível (${balance})` }
    }
  }

  if (availableItems.length > 0) {
    const distinctIds = availableItems.map((m) => m.material_id)
    const { data: materials, error: matError } = await supabase
      .from("materials")
      .select("id, name, status, status_atual, stock_quantity")
      .in("id", distinctIds)

    if (matError) return { error: matError.message }
    if (!materials || materials.length !== distinctIds.length) {
      return { error: "Um ou mais materiais não foram encontrados" }
    }

    const unavailable = materials.filter((m) => m.status !== "available")
    if (unavailable.length > 0) {
      return { error: formatUnavailableMaterialsMessage(unavailable) }
    }

    const merged = mergeCautelaItems(availableItems)
    const stockErr = validateCautelaItemsStock(merged, materials)
    if (stockErr) return { error: stockErr }
  }

  const now = new Date().toISOString()
  const { data: deadlineData } = await supabase.rpc("calc_daily_return_deadline")
  const deadline = deadlineData as string | null

  const { data: tenantData } = await supabase
    .from("usuarios")
    .select("organization_id, unit_id, reserva_id")
    .eq("auth_user_id", operatorId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()

  const tenant = tenantData as { organization_id: string; unit_id: string; reserva_id: string } | null

  const { data: newCautela, error: createError } = await supabase
    .from("cautelas")
    .insert({
      person_id: payload.person_id,
      operator_id: operatorId,
      type: "daily",
      status: "open",
      notes: payload.notes ?? null,
      data_prevista_devolucao: deadline,
      organization_id: tenant?.organization_id ?? null,
      unit_id: tenant?.unit_id ?? null,
      reserva_id: tenant?.reserva_id ?? null,
    })
    .select("id")
    .single()

  if (createError) return { error: createError.message }
  const newCautelaId = (newCautela as any).id

  for (const ti of transferItems) {
    const { data: originItem } = await supabase
      .from("cautela_items")
      .select("id, cautela_id, material_id, quantity_delivered, quantity_returned, status")
      .eq("id", ti.transfer_from_cautela_item_id)
      .single()

    if (!originItem) continue

    const prevReturned = originItem.quantity_returned || 0
    const newReturned = prevReturned + ti.quantity
    const delivered = originItem.quantity_delivered || 1
    const itemStatus: "pending" | "returned" = newReturned >= delivered ? "returned" : "pending"

    await supabase
      .from("cautela_items")
      .update({
        quantity_returned: newReturned,
        status: itemStatus,
        returned_at: itemStatus === "returned" ? now : null,
        returned_by: itemStatus === "returned" ? operatorId : null,
      })
      .eq("id", ti.transfer_from_cautela_item_id)

    await supabase
      .from("cautela_items")
      .insert({
        cautela_id: newCautelaId,
        material_id: ti.material_id,
        status: "pending",
        quantity_delivered: ti.quantity,
        organization_id: tenant?.organization_id ?? null,
        unit_id: tenant?.unit_id ?? null,
        reserva_id: tenant?.reserva_id ?? null,
      })

    await syncCautelaStatusFromItems(supabase, originItem.cautela_id, operatorId, now)

    await logAudit({
      action: "item_transferred",
      entity: "cautela_items",
      entity_id: ti.transfer_from_cautela_item_id!,
      before_state: {
        cautela_id: originItem.cautela_id,
        material_id: ti.material_id,
        status: originItem.status,
        quantity_returned: prevReturned,
      },
      after_state: {
        cautela_id_destino: newCautelaId,
        material_id: ti.material_id,
        status: itemStatus,
        quantity_returned: newReturned,
        quantity_transferred: ti.quantity,
      },
    })
  }

  if (availableItems.length === 0) {
    await logAudit({
      action: "cautela_created",
      entity: "cautelas",
      entity_id: newCautelaId,
      after_state: {
        person_id: payload.person_id,
        type: "daily",
        materials_count: transferItems.length,
        items: transferItems.map((ti) => ({ material_id: ti.material_id, quantity: ti.quantity })),
        transfer_count: transferItems.length,
        transfer_only: true,
        auth: "face",
      },
    })
  } else {
    const merged = mergeCautelaItems(availableItems)

    for (const item of merged) {
      const { data: matItem } = await supabase
        .from("materials")
        .select("id, name, stock_quantity")
        .eq("id", item.material_id)
        .single()

      if (!matItem) continue

      await supabase
        .from("cautela_items")
        .insert({
          cautela_id: newCautelaId,
          material_id: item.material_id,
          status: "pending",
          quantity_delivered: item.quantity,
          organization_id: tenant?.organization_id ?? null,
          unit_id: tenant?.unit_id ?? null,
          reserva_id: tenant?.reserva_id ?? null,
        })

      const newStock = Math.max(0, (matItem.stock_quantity ?? 1) - item.quantity)
      const newMatStatus = newStock <= 0 ? "cautelado" : "available"
      await supabase
        .from("materials")
        .update({ stock_quantity: newStock, status: newMatStatus, updated_at: now })
        .eq("id", item.material_id)
    }

    await logAudit({
      action: "cautela_created",
      entity: "cautelas",
      entity_id: newCautelaId,
      after_state: {
        person_id: payload.person_id,
        type: "daily",
        materials_count: merged.length,
        items: merged,
        transfer_count: transferItems.length,
        auth: "face",
      },
    })
  }

  await dispatchCautelaNotifications(newCautelaId).catch(console.error)
  await dispatchTransferNotifications(newCautelaId, transferItems).catch(console.error)

  revalidatePath("/cautelas")
  revalidatePath("/materials")
  return { success: true, cautelaId: newCautelaId }
}

async function dispatchTransferNotifications(
  newCautelaId: string,
  transferItems: { material_id: string; quantity: number; transfer_from_cautela_item_id?: string }[]
) {
  if (transferItems.length === 0) return

  const supabase = await createClient()

  const { data: destCautela } = await supabase
    .from("cautelas")
    .select(`id, persons(id, full_name, rg, email, phone)`)
    .eq("id", newCautelaId)
    .single()

  if (!destCautela) return

  const destPerson = destCautela.persons as any
  const originCautelaIds = new Set<string>()

  for (const ti of transferItems) {
    if (!ti.transfer_from_cautela_item_id) continue
    const { data: originItem } = await supabase
      .from("cautela_items")
      .select("cautela_id")
      .eq("id", ti.transfer_from_cautela_item_id)
      .single()
    if (originItem) originCautelaIds.add(originItem.cautela_id)
  }

  const resendKey = process.env.RESEND_API_KEY
  const archiveEmail = process.env.ARCHIVE_EMAIL
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"

  if (!resendKey) return

  const resend = new Resend(resendKey)

  const { data: materials } = await supabase
    .from("materials")
    .select("id, name, patrimony_number")
    .in("id", transferItems.map((ti) => ti.material_id))

  const matMap = new Map<string, Record<string, any>>((materials ?? [] as any[]).map((m: any) => [m.id, m]))

  for (const originCautelaId of originCautelaIds) {
    const { data: originCautela } = await supabase
      .from("cautelas")
      .select(`id, persons(id, full_name, rg, email, phone)`)
      .eq("id", originCautelaId)
      .single()

    if (!originCautela) continue
    const originPerson = originCautela.persons as any

    const transferredFromThisCautela: typeof transferItems = []
    for (const ti of transferItems) {
      if (!ti.transfer_from_cautela_item_id) continue
      const { data: oi } = await supabase
        .from("cautela_items")
        .select("cautela_id")
        .eq("id", ti.transfer_from_cautela_item_id)
        .single()
      if (oi?.cautela_id === originCautelaId) transferredFromThisCautela.push(ti)
    }

    const itemsList = transferredFromThisCautela
      .map((ti) => {
        const m = matMap.get(ti.material_id)
        return `• ${m?.name || "Material"} (Pat: ${m?.patrimony_number || "?"}) — ${ti.quantity} un.`
      })
      .join("\n")

    if (originPerson?.email) {
      try {
        await resend.emails.send({
          from: fromEmail,
          to: [originPerson.email],
          subject: `Material transferido da sua cautela — ${new Date().toLocaleDateString("pt-BR")}`,
          text: `Olá ${originPerson.full_name},\n\nOs seguintes materiais foram transferidos da sua cautela para ${destPerson?.full_name || "outra pessoa"}:\n\n${itemsList}\n\nSistema RESERVA`,
        })
      } catch {}
    }
  }

  const allRecipients: string[] = []
  if (destPerson?.email) allRecipients.push(destPerson.email)
  if (archiveEmail) allRecipients.push(archiveEmail)

  if (allRecipients.length > 0) {
    const itemsList = transferItems
      .map((ti) => {
        const m = matMap.get(ti.material_id)
        return `• ${m?.name || "Material"} (Pat: ${m?.patrimony_number || "?"}) — ${ti.quantity} un. [TRANSFERIDO]`
      })
      .join("\n")

    try {
      await resend.emails.send({
        from: fromEmail,
        to: allRecipients,
        subject: `Cautela com Transferência - ${new Date().toLocaleDateString("pt-BR")}`,
        text: `Olá ${destPerson?.full_name || ""},\n\nVocê recebeu materiais em cautela Diária (incluindo itens transferidos):\n\n${itemsList}\n\nSistema RESERVA`,
      })
    } catch {}
  }
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
  await assertCautelaOperator()
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

// ===== REGISTRAR VISTORIA ANUAL (cautela permanente) =====
export async function registrarVistoria(cautelaId: string, observacao?: string) {
  const idParsed = uuidSchema.safeParse(cautelaId)
  if (!idParsed.success) return { error: "ID de cautela inválido" }

  const auth = await requireCautelaOperator()
  if ("error" in auth) return { error: auth.error }

  const supabase = await createClient()

  const { data, error } = await supabase.rpc("registrar_vistoria", {
    p_cautela_id: cautelaId,
    p_observacao: observacao ?? null,
  })

  if (error) {
    return { error: mapVistoriaRpcError(error.message) }
  }

  const result = data as {
    cautela_id: string
    movimentacao_ids?: string[]
    next_review_date?: string
  } | null

  await logAudit({
    action: "vistoria_registrada",
    entity: "cautelas",
    entity_id: cautelaId,
    after_state: {
      movimentacao_ids: result?.movimentacao_ids ?? [],
      next_review_date: result?.next_review_date,
      observacao: observacao ?? null,
    },
  })

  revalidatePath("/cautelas")
  revalidatePath("/alerts")
  revalidatePath("/")
  revalidatePath("/history")

  return {
    success: true,
    nextReviewDate: result?.next_review_date ?? null,
  }
}