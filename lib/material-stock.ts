/** Estoque físico em `materials.stock_quantity` (armas unitárias = 1; munição/carregador fungível = N). */

export type StockMaterial = {
  id?: string
  name?: string
  stock_quantity?: number | null
  status?: string | null
}

export function effectiveStock(m: StockMaterial): number {
  if (m.stock_quantity == null) return 1
  return Math.max(0, m.stock_quantity)
}

export function isFungibleStock(m: StockMaterial): boolean {
  return effectiveStock(m) > 1
}

export function canReserveStock(m: StockMaterial, qty: number): boolean {
  if (m.status && m.status !== "available") return false
  return effectiveStock(m) >= qty
}

export function stockStatusAfterReserve(remainingStock: number): "available" | "cautelado" {
  return remainingStock > 0 ? "available" : "cautelado"
}

/** Unidades devolvidas ao estoque nesta atualização (delta). */
export function stockRestoreDelta(previousReturned: number, newReturned: number): number {
  return Math.max(0, newReturned - previousReturned)
}

export function stockStatusAfterReturn(
  stockAfterRestore: number,
  itemStatus: "pending" | "returned" | "damaged" | "missing",
  qtyReturned: number,
  qtyDelivered: number
): string {
  if (itemStatus === "damaged") return "maintenance"
  if (itemStatus === "missing") return "unavailable"
  if (stockAfterRestore > 0) return "available"
  if (qtyReturned >= qtyDelivered) return "available"
  if (qtyReturned > 0) return "cautelado"
  return "cautelado"
}

export function formatInsufficientStockMessage(
  material: { name?: string },
  requested: number,
  available: number
): string {
  const label = material.name?.trim() || "Material"
  return `Estoque insuficiente para "${label}": pedido ${requested}, disponível ${available}.`
}

export type StockResolvable = StockMaterial & { id: string }

/**
 * Resolve N unidades: N registros distintos (pool unitário) ou 1 registro com estoque >= N.
 */
export function resolveStockUnits<T extends StockResolvable>(
  candidates: T[],
  count: number,
  pickBest: (pool: T[]) => T | null
): { items: T[]; error?: string } {
  if (count < 1) return { items: [] }

  const available = candidates.filter((m) => canReserveStock(m, 1))
  if (available.length === 0) {
    return { items: [], error: "Nenhum item disponível em estoque." }
  }

  if (available.length >= count) {
    const picked: T[] = []
    const exclude: string[] = []
    for (let i = 0; i < count; i++) {
      const pool = available.filter((m) => !exclude.includes(m.id))
      const one = pickBest(pool)
      if (!one) break
      picked.push(one)
      exclude.push(one.id)
    }
    if (picked.length >= count) return { items: picked }
  }

  const best = pickBest(available)
  const stock = best ? effectiveStock(best) : 0
  if (!best || stock < count) {
    return {
      items: [],
      error: formatInsufficientStockMessage(best ?? {}, count, stock),
    }
  }

  return { items: Array.from({ length: count }, () => best) }
}

export function computeMaterialAfterReturn(
  currentStock: number,
  previousReturned: number,
  newReturned: number,
  itemStatus: "pending" | "returned" | "damaged" | "missing",
  qtyDelivered: number
): { stock_quantity: number; status: string } {
  let stock = Math.max(0, currentStock)
  if (itemStatus !== "damaged" && itemStatus !== "missing") {
    stock += stockRestoreDelta(previousReturned, newReturned)
  }
  return {
    stock_quantity: stock,
    status: stockStatusAfterReturn(stock, itemStatus, newReturned, qtyDelivered),
  }
}
