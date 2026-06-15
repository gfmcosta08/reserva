/**
 * Tenant context utilities for multi-tenant isolation.
 * Stub — returns null/no-op for single-tenant deployments.
 */

export async function getTenantContextForUser(
  _userId: string
): Promise<{ organization_id: string; unit_id: string; reserva_id: string } | null> {
  return null
}

export function withTenantScope<T extends Record<string, any>>(
  record: T,
  _tenant: { organization_id: string; unit_id: string; reserva_id: string } | null
): T {
  return record
}
