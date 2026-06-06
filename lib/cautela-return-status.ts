/** Regras PRD §7.1–7.3: status de cautela e saldo por quantidade. */

export type CautelaItemStatusRow = {
  status: string
  quantity_delivered?: number | null
  quantity_returned?: number | null
}

export function qtyDelivered(item: CautelaItemStatusRow): number {
  return item.quantity_delivered || 1
}

export function qtyReturned(item: CautelaItemStatusRow): number {
  return item.quantity_returned || 0
}

/** Unidades ainda em custódia nesta linha. */
export function itemBalance(item: CautelaItemStatusRow): number {
  return Math.max(0, qtyDelivered(item) - qtyReturned(item))
}

export function itemIsFullyReturned(item: CautelaItemStatusRow): boolean {
  return item.status === "returned" && itemBalance(item) === 0
}

/** Linha ainda exige devolução (pending ou saldo em linha returned legada). */
export function itemNeedsReturn(item: CautelaItemStatusRow): boolean {
  if (item.status === "damaged" || item.status === "missing") return false
  if (item.status === "pending") return itemBalance(item) > 0
  if (item.status === "returned") return itemBalance(item) > 0
  return false
}

export function hasTrueDivergence(items: CautelaItemStatusRow[]): boolean {
  return items.some((i) => i.status === "damaged" || i.status === "missing")
}

export function hasOpenBalance(items: CautelaItemStatusRow[]): boolean {
  return items.some((i) => itemNeedsReturn(i))
}

export type CautelaAggregateStatus = "open" | "partial" | "closed" | "divergent"

export function computeCautelaStatus(items: CautelaItemStatusRow[]): CautelaAggregateStatus {
  if (!items.length) return "open"
  if (hasTrueDivergence(items)) return "divergent"
  if (items.every((i) => itemIsFullyReturned(i))) return "closed"
  const anyProgress = items.some(
    (i) =>
      itemIsFullyReturned(i) ||
      (i.status === "pending" && qtyReturned(i) > 0) ||
      itemNeedsReturn(i)
  )
  if (anyProgress) return "partial"
  return "open"
}

export function materialStatusAfterReturn(
  itemStatus: "returned" | "damaged" | "missing" | "pending",
  quantityReturned: number,
  quantityDelivered: number
): string {
  if (itemStatus === "damaged") return "maintenance"
  if (itemStatus === "missing") return "unavailable"
  if (quantityReturned >= quantityDelivered) return "available"
  if (quantityReturned > 0) return "cautelado"
  return "cautelado"
}

/** Resolve status da linha após devolução normal (não damaged/missing). */
export function resolveItemStatusAfterReturn(
  quantityReturned: number,
  quantityDelivered: number
): "pending" | "returned" {
  if (quantityReturned >= quantityDelivered) return "returned"
  return "pending"
}
