export { getDefaultTenantIds, withTenant } from "../../import/lib/tenant-default.mjs"

export async function setMaterialAvailable(supabase, id, stock = 1) {
  await supabase
    .from("materials")
    .update({
      status: "available",
      status_atual: "DISPONIVEL",
      stock_quantity: stock,
      person_responsavel_id: null,
    })
    .eq("id", id)
}

export async function setMaterialCautelado(supabase, id, { personId, stock = 0, permanent = true } = {}) {
  await supabase
    .from("materials")
    .update({
      status: "cautelado",
      status_atual: permanent ? "CAUTELADO_PERMANENTE" : "CAUTELADO_TEMPORARIO",
      stock_quantity: stock,
      person_responsavel_id: personId ?? null,
    })
    .eq("id", id)
}

export function cautelaRow(tenant, fields) {
  return {
    ...fields,
    organization_id: tenant.organization_id,
    unit_id: tenant.unit_id,
    reserva_id: tenant.reserva_id,
  }
}

export function cautelaItemRow(tenant, fields) {
  return {
    ...fields,
    organization_id: tenant.organization_id,
    unit_id: tenant.unit_id,
    reserva_id: tenant.reserva_id,
  }
}
