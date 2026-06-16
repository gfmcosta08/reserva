/** IDs padrão org/unit/reserva 1º BPM (teste_db após Etapa 1). */
export async function getDefaultTenantIds(supabase) {
  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "1bpm")
    .single()
  if (orgErr || !org) throw new Error("organizations 1bpm ausente — rode migration etapa1")

  const { data: unit, error: unitErr } = await supabase
    .from("units")
    .select("id")
    .eq("organization_id", org.id)
    .eq("code", "1BPM")
    .single()
  if (unitErr || !unit) throw new Error("units 1BPM ausente — rode migration etapa1")

  const { data: reserva, error: resErr } = await supabase
    .from("reservas")
    .select("id")
    .eq("unit_id", unit.id)
    .eq("code", "RES-1BPM")
    .single()
  if (resErr || !reserva) throw new Error("reservas RES-1BPM ausente — rode migration etapa1 reservas")

  return {
    organization_id: org.id,
    unit_id: unit.id,
    reserva_id: reserva.id,
  }
}

export function withTenant(spec, tenant) {
  return {
    ...spec,
    organization_id: tenant.organization_id,
    unit_id: tenant.unit_id,
    reserva_id: tenant.reserva_id,
  }
}
