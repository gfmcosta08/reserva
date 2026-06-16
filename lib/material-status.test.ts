import { describe, expect, it } from "vitest"
import {
  categoryToTipoMaterial,
  enumStatusToLegacy,
  isStatusDisponivel,
  legacyStatusToEnum,
  resolveMaterialStatus,
} from "./material-status"

describe("material-status", () => {
  it("mapeia status legado para ENUM", () => {
    expect(legacyStatusToEnum("available")).toBe("DISPONIVEL")
    expect(legacyStatusToEnum("cautelado")).toBe("CAUTELADO_TEMPORARIO")
    expect(legacyStatusToEnum("maintenance")).toBe("MANUTENCAO")
  })

  it("mapeia ENUM para legado", () => {
    expect(enumStatusToLegacy("DISPONIVEL")).toBe("available")
    expect(enumStatusToLegacy("CAUTELADO_PERMANENTE")).toBe("cautelado")
  })

  it("resolve status_atual com prioridade sobre status", () => {
    expect(
      resolveMaterialStatus({ status_atual: "MANUTENCAO", status: "available" })
    ).toBe("MANUTENCAO")
    expect(resolveMaterialStatus({ status: "available" })).toBe("DISPONIVEL")
  })

  it("identifica disponível para cautela", () => {
    expect(isStatusDisponivel({ status_atual: "DISPONIVEL" })).toBe(true)
    expect(isStatusDisponivel({ status: "available" })).toBe(true)
    expect(isStatusDisponivel({ status_atual: "CAUTELADO_TEMPORARIO" })).toBe(false)
  })

  it("mapeia categoria para tipo_material", () => {
    expect(categoryToTipoMaterial("ARMA CURTA")).toBe("ARMA_CURTA")
    expect(categoryToTipoMaterial("MUNIÇÃO")).toBe("MUNICAO")
    expect(categoryToTipoMaterial("XPTO")).toBe("OUTRO")
  })
})
