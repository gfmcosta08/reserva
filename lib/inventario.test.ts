import { describe, expect, it } from "vitest"
import {
  INVENTARIO_ITEM_STATUS_LABELS,
  INVENTARIO_STATUS_LABELS,
  summarizeInventarioItens,
} from "./inventario"

describe("inventario helpers", () => {
  it("expõe labels em português", () => {
    expect(INVENTARIO_STATUS_LABELS.ABERTO).toBe("Aberto")
    expect(INVENTARIO_ITEM_STATUS_LABELS.NAO_ENCONTRADO).toBe("Não encontrado")
  })

  it("summarizeInventarioItens calcula total e hasIssues", () => {
    expect(
      summarizeInventarioItens({ conferidos: 5, divergentes: 0, nao_encontrados: 0 })
    ).toEqual({ total: 5, hasIssues: false })

    expect(
      summarizeInventarioItens({ conferidos: 3, divergentes: 1, nao_encontrados: 0 })
    ).toEqual({ total: 4, hasIssues: true })
  })
})
