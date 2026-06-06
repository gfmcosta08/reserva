import { describe, expect, it } from "vitest"
import {
  canReserveStock,
  computeMaterialAfterReturn,
  effectiveStock,
  isFungibleStock,
  resolveStockUnits,
  stockRestoreDelta,
  stockStatusAfterReserve,
  stockStatusAfterReturn,
} from "./material-stock"

describe("material-stock", () => {
  it("effectiveStock trata null como 1", () => {
    expect(effectiveStock({})).toBe(1)
    expect(effectiveStock({ stock_quantity: 5 })).toBe(5)
    expect(effectiveStock({ stock_quantity: -2 })).toBe(0)
  })

  it("isFungibleStock quando stock > 1", () => {
    expect(isFungibleStock({ stock_quantity: 1 })).toBe(false)
    expect(isFungibleStock({ stock_quantity: 50 })).toBe(true)
  })

  it("canReserveStock exige available e saldo", () => {
    expect(canReserveStock({ status: "available", stock_quantity: 3 }, 2)).toBe(true)
    expect(canReserveStock({ status: "cautelado", stock_quantity: 3 }, 1)).toBe(false)
    expect(canReserveStock({ status: "available", stock_quantity: 1 }, 2)).toBe(false)
  })

  it("stockStatusAfterReserve mantém available se sobrar", () => {
    expect(stockStatusAfterReserve(2)).toBe("available")
    expect(stockStatusAfterReserve(0)).toBe("cautelado")
  })

  it("stockRestoreDelta só conta incremento", () => {
    expect(stockRestoreDelta(0, 1)).toBe(1)
    expect(stockRestoreDelta(1, 1)).toBe(0)
    expect(stockRestoreDelta(2, 1)).toBe(0)
  })

  it("computeMaterialAfterReturn restaura parcial fungível", () => {
    const r = computeMaterialAfterReturn(0, 0, 1, "pending", 3)
    expect(r.stock_quantity).toBe(1)
    expect(r.status).toBe("available")
  })

  it("computeMaterialAfterReturn total devolvido zera cautela", () => {
    const r = computeMaterialAfterReturn(0, 0, 3, "returned", 3)
    expect(r.stock_quantity).toBe(3)
    expect(r.status).toBe("available")
  })

  it("stockStatusAfterReturn damaged → maintenance", () => {
    expect(stockStatusAfterReturn(1, "damaged", 0, 1)).toBe("maintenance")
    expect(stockStatusAfterReturn(0, "missing", 0, 1)).toBe("unavailable")
  })

  it("resolveStockUnits pega N distintos ou 1 fungível", () => {
    const pool = [
      { id: "a", status: "available", stock_quantity: 1 },
      { id: "b", status: "available", stock_quantity: 1 },
      { id: "c", status: "available", stock_quantity: 1 },
    ]
    const distinct = resolveStockUnits(pool, 2, (p) => p[0])
    expect(distinct.items).toHaveLength(2)
    expect(new Set(distinct.items.map((m) => m.id)).size).toBe(2)

    const fungible = resolveStockUnits(
      [{ id: "x", name: "MUN", status: "available", stock_quantity: 50 }],
      3,
      (p) => p[0]
    )
    expect(fungible.items).toHaveLength(3)
    expect(fungible.items.every((m) => m.id === "x")).toBe(true)
  })
})
