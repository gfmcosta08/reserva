"use server"

import { createClient } from "@/lib/supabase-server"
import { requireCautelaOperator, requireCautelaOperatorOrThrow } from "@/lib/auth-cautela"
import { getTenantContextForUser, withTenantScope } from "@/lib/tenant-context"

export type AuditAction =
  | "cautela_created"
  | "cautela_closed"
  | "cautela_renewed"
  | "vistoria_registrada"
  | "item_returned"
  | "item_damaged"
  | "item_missing"
  | "item_transferred"
  | "person_created"
  | "person_updated"
  | "material_created"
  | "material_updated"
  | "material_status_changed"
  | "correction_made"

export async function logAudit(params: {
  action: AuditAction
  entity: string
  entity_id: string
  before_state?: Record<string, any>
  after_state?: Record<string, any>
}) {
  const auth = await requireCautelaOperator()
  if ("error" in auth) return

  const supabase = await createClient()

  const tenant = await getTenantContextForUser(auth.user.id)
  if (!tenant) return

  await supabase.from("audit_logs").insert(
    withTenantScope(
      {
        user_id: auth.user.id,
        action: params.action,
        entity: params.entity,
        entity_id: params.entity_id,
        before_state: params.before_state || null,
        after_state: params.after_state || null,
      },
      tenant
    )
  )
}

// Listar logs de auditoria
export async function getAuditLogs(filters?: {
  entity?: string
  action?: string
  limit?: number
  offset?: number
}) {
  await requireCautelaOperatorOrThrow()
  const supabase = await createClient()
  let query = supabase
    .from("audit_logs")
    .select("*, profiles(name, email)")
    .order("timestamp", { ascending: false })
    .range(
      filters?.offset || 0,
      (filters?.offset || 0) + (filters?.limit || 50) - 1
    )

  if (filters?.entity) {
    query = query.eq("entity", filters.entity)
  }
  if (filters?.action) {
    query = query.eq("action", filters.action)
  }

  const { data, error } = await query
  if (error) return []
  return data
}

// Contar total de logs (para paginação)
export async function countAuditLogs(filters?: { entity?: string; action?: string }) {
  await requireCautelaOperatorOrThrow()
  const supabase = await createClient()
  let query = supabase.from("audit_logs").select("*", { count: "exact", head: true })

  if (filters?.entity) query = query.eq("entity", filters.entity)
  if (filters?.action) query = query.eq("action", filters.action)

  const { count } = await query
  return count || 0
}
