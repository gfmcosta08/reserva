"use server"

import { createClient } from "@/lib/supabase-server"
import { requireCautelaOperatorOrThrow } from "@/lib/auth-cautela"
import { getTenantContextForUser, withTenantScope } from "@/lib/tenant-context"
import { logAudit } from "./audit"
import type { InventarioItemStatus, InventarioStatus } from "@/lib/inventario"

export type InventarioRow = {
  id: string
  status: InventarioStatus
  started_at: string
  closed_at: string | null
  observacao: string | null
  operador_id: string
  total_itens?: number
  conferidos?: number
  divergentes?: number
  nao_encontrados?: number
}

export type InventarioItemRow = {
  inventario_id: string
  material_id: string
  status: InventarioItemStatus
  observacao: string | null
  conferido_at: string
  materials: {
    id: string
    name: string
    patrimony_number: string | null
    serial_number: string | null
    category: string | null
    status: string
  } | null
}

export type InventarioDetail = InventarioRow & {
  itens: InventarioItemRow[]
}

export type MaterialSearchResult = {
  id: string
  name: string
  patrimony_number: string | null
  serial_number: string | null
  category: string | null
  status: string
}

export async function criarInventario(observacao?: string): Promise<{ id: string } | { error: string }> {
  const { user } = await requireCautelaOperatorOrThrow()
  const tenant = await getTenantContextForUser(user.id)
  if (!tenant) return { error: "Contexto de reserva não encontrado" }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("inventarios")
    .insert(
      withTenantScope(
        {
          operador_id: user.id,
          observacao: observacao?.trim() || null,
          status: "ABERTO",
        },
        tenant
      )
    )
    .select("id")
    .single()

  if (error || !data) return { error: error?.message ?? "Falha ao criar inventário" }

  await logAudit({
    action: "material_created",
    entity: "inventarios",
    entity_id: data.id,
    after_state: { status: "ABERTO", observacao: observacao ?? null },
  })

  return { id: data.id }
}

export async function adicionarItemConferido(
  inventarioId: string,
  materialId: string,
  status: InventarioItemStatus,
  observacao?: string
): Promise<{ ok: true } | { error: string }> {
  const { user } = await requireCautelaOperatorOrThrow()
  const tenant = await getTenantContextForUser(user.id)
  if (!tenant) return { error: "Contexto de reserva não encontrado" }

  const supabase = await createClient()

  const { data: inv, error: invErr } = await supabase
    .from("inventarios")
    .select("id, status")
    .eq("id", inventarioId)
    .eq("status", "ABERTO")
    .maybeSingle()

  if (invErr || !inv) return { error: "Inventário não encontrado ou já encerrado" }

  const { data: mat, error: matErr } = await supabase
    .from("materials")
    .select("id")
    .eq("id", materialId)
    .maybeSingle()

  if (matErr || !mat) return { error: "Material não encontrado na reserva" }

  const { error } = await supabase.from("inventario_itens").upsert(
    withTenantScope(
      {
        inventario_id: inventarioId,
        material_id: materialId,
        status,
        observacao: observacao?.trim() || null,
        conferido_at: new Date().toISOString(),
      },
      tenant
    ),
    { onConflict: "inventario_id,material_id" }
  )

  if (error) return { error: error.message }
  return { ok: true }
}

export async function fecharInventario(
  inventarioId: string
): Promise<
  | {
      inventario_id: string
      status: string
      total_itens: number
      conferidos: number
      divergentes: number
      nao_encontrados: number
      divergencias_criadas: number
    }
  | { error: string }
> {
  const { user } = await requireCautelaOperatorOrThrow()
  const supabase = await createClient()

  const { data, error } = await supabase.rpc("fechar_inventario", {
    p_inventario_id: inventarioId,
  })

  if (error) {
    const msg = error.message
    if (msg.includes("INVENTARIO_NOT_FOUND")) return { error: "Inventário não encontrado" }
    if (msg.includes("INVENTARIO_NOT_OPEN")) return { error: "Inventário já foi encerrado" }
    if (msg.includes("NOT_AUTHENTICATED")) return { error: "Operador não autenticado" }
    return { error: msg }
  }

  const result = data as Record<string, number | string>
  await logAudit({
    action: "material_status_changed",
    entity: "inventarios",
    entity_id: inventarioId,
    after_state: result,
  })

  return {
    inventario_id: String(result.inventario_id),
    status: String(result.status),
    total_itens: Number(result.total_itens ?? 0),
    conferidos: Number(result.conferidos ?? 0),
    divergentes: Number(result.divergentes ?? 0),
    nao_encontrados: Number(result.nao_encontrados ?? 0),
    divergencias_criadas: Number(result.divergencias_criadas ?? 0),
  }
}

export async function listInventarios(status?: InventarioStatus): Promise<InventarioRow[]> {
  await requireCautelaOperatorOrThrow()
  const supabase = await createClient()

  let query = supabase
    .from("inventarios")
    .select("id, status, started_at, closed_at, observacao, operador_id")
    .order("started_at", { ascending: false })
    .limit(50)

  if (status) query = query.eq("status", status)

  const { data: inventarios, error } = await query
  if (error || !inventarios) return []

  const ids = inventarios.map((i) => i.id)
  if (ids.length === 0) return []

  const { data: itens } = await supabase
    .from("inventario_itens")
    .select("inventario_id, status")
    .in("inventario_id", ids)

  const counts = new Map<string, { conferidos: number; divergentes: number; nao_encontrados: number }>()
  for (const item of itens ?? []) {
    const c = counts.get(item.inventario_id) ?? { conferidos: 0, divergentes: 0, nao_encontrados: 0 }
    if (item.status === "CONFERIDO") c.conferidos++
    else if (item.status === "DIVERGENTE") c.divergentes++
    else if (item.status === "NAO_ENCONTRADO") c.nao_encontrados++
    counts.set(item.inventario_id, c)
  }

  return inventarios.map((inv) => {
    const c = counts.get(inv.id) ?? { conferidos: 0, divergentes: 0, nao_encontrados: 0 }
    return {
      ...inv,
      status: inv.status as InventarioStatus,
      total_itens: c.conferidos + c.divergentes + c.nao_encontrados,
      conferidos: c.conferidos,
      divergentes: c.divergentes,
      nao_encontrados: c.nao_encontrados,
    }
  })
}

export async function getInventarioById(id: string): Promise<InventarioDetail | null> {
  await requireCautelaOperatorOrThrow()
  const supabase = await createClient()

  const { data: inv, error } = await supabase
    .from("inventarios")
    .select("id, status, started_at, closed_at, observacao, operador_id")
    .eq("id", id)
    .maybeSingle()

  if (error || !inv) return null

  const { data: itens } = await supabase
    .from("inventario_itens")
    .select(`
      inventario_id,
      material_id,
      status,
      observacao,
      conferido_at,
      materials (
        id, name, patrimony_number, serial_number, category, status
      )
    `)
    .eq("inventario_id", id)
    .order("conferido_at", { ascending: false })

  const mappedItens: InventarioItemRow[] = (itens ?? []).map((row) => {
    const mat = Array.isArray(row.materials) ? row.materials[0] : row.materials
    return {
      inventario_id: row.inventario_id,
      material_id: row.material_id,
      status: row.status as InventarioItemStatus,
      observacao: row.observacao,
      conferido_at: row.conferido_at,
      materials: mat ?? null,
    }
  })

  const conferidos = mappedItens.filter((i) => i.status === "CONFERIDO").length
  const divergentes = mappedItens.filter((i) => i.status === "DIVERGENTE").length
  const nao_encontrados = mappedItens.filter((i) => i.status === "NAO_ENCONTRADO").length

  return {
    ...inv,
    status: inv.status as InventarioStatus,
    total_itens: mappedItens.length,
    conferidos,
    divergentes,
    nao_encontrados,
    itens: mappedItens,
  }
}

export async function buscarMaterialPorPatrimonio(
  patrimony: string
): Promise<MaterialSearchResult | { error: string }> {
  await requireCautelaOperatorOrThrow()
  const supabase = await createClient()
  const term = patrimony.trim()
  if (!term) return { error: "Informe o patrimônio" }

  const { data, error } = await supabase
    .from("materials")
    .select("id, name, patrimony_number, serial_number, category, status")
    .or(`patrimony_number.eq.${term},internal_code.eq.${term},serial_number.eq.${term}`)
    .limit(1)
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data) return { error: "Material não encontrado" }
  return data
}

export async function cancelarInventario(inventarioId: string): Promise<{ ok: true } | { error: string }> {
  await requireCautelaOperatorOrThrow()
  const supabase = await createClient()

  const { error } = await supabase
    .from("inventarios")
    .update({ status: "CANCELADO", closed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", inventarioId)
    .eq("status", "ABERTO")

  if (error) return { error: error.message }
  return { ok: true }
}
