export type InventarioStatus = "ABERTO" | "FECHADO" | "CANCELADO"
export type InventarioItemStatus = "CONFERIDO" | "DIVERGENTE" | "NAO_ENCONTRADO"

export const INVENTARIO_STATUS_LABELS: Record<InventarioStatus, string> = {
  ABERTO: "Aberto",
  FECHADO: "Fechado",
  CANCELADO: "Cancelado",
}

export const INVENTARIO_ITEM_STATUS_LABELS: Record<InventarioItemStatus, string> = {
  CONFERIDO: "Conferido",
  DIVERGENTE: "Divergente",
  NAO_ENCONTRADO: "Não encontrado",
}

export function summarizeInventarioItens(counts: {
  conferidos: number
  divergentes: number
  nao_encontrados: number
}): { total: number; hasIssues: boolean } {
  const total = counts.conferidos + counts.divergentes + counts.nao_encontrados
  return {
    total,
    hasIssues: counts.divergentes > 0 || counts.nao_encontrados > 0,
  }
}
