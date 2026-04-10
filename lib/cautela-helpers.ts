/** Helpers compartilhados do domínio de cautelas (validação de estado, mensagens). */

export function canModifyCautela(status: string | null | undefined): boolean {
  return status === "open" || status === "partial"
}

export function validateCautelaModifiable(cautela: { status: string; id?: string } | null | undefined): {
  valid: boolean
  error?: string
} {
  if (!cautela) {
    return { valid: false, error: "Cautela não encontrada" }
  }
  if (!canModifyCautela(cautela.status)) {
    return { valid: false, error: "Apenas cautelas abertas ou parciais podem ser modificadas" }
  }
  return { valid: true }
}

const STATUS_LABELS: Record<string, string> = {
  available: "disponível",
  cautelado: "já cautelado",
  maintenance: "em manutenção",
  unavailable: "indisponível",
  pending_return: "pendência de devolução",
  in_use: "em uso",
  blocked: "bloqueado",
}

export function materialStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}

export function formatUnavailableMaterialsMessage(
  materials: { id: string; name: string; status: string }[]
): string {
  const detalhes = materials.map((m) => `${m.name} (${materialStatusLabel(m.status)})`).join(", ")
  return `Materiais não disponíveis: ${detalhes}`
}

/** Agrupa linhas com o mesmo material_id somando quantidades (envio à RPC). */
export function mergeCautelaItems(
  items: { material_id: string; quantity?: number }[]
): { material_id: string; quantity: number }[] {
  const map = new Map<string, number>()
  for (const i of items) {
    const q = i.quantity ?? 1
    map.set(i.material_id, (map.get(i.material_id) || 0) + q)
  }
  return [...map.entries()].map(([material_id, quantity]) => ({ material_id, quantity }))
}
