import { describe, expect, it } from "vitest"
import {
  buildPackAccessoryPool,
  filterPackCandidatesForWeapon,
  isAmmunitionCompatibleWithWeapon,
  isChargerCompatibleWithWeapon,
  pickPackAccessoryForWeapon,
  type PackAccessoryCandidate,
  type PackWeaponContext,
} from "./cautela-pack-accessories"
import { filterReservableMaterials } from "./cautela-reservable"

const glockWeapon: PackWeaponContext = {
  name: "PISTOLA GLOCK G19 GEN5",
  category: "ARMA CURTA",
  calibre: "9mm",
  marca: "GLOCK",
  modelo: "G19",
}

function charger(overrides: Partial<PackAccessoryCandidate> = {}): PackAccessoryCandidate {
  return {
    id: overrides.id ?? "chg-1",
    name: overrides.name ?? "CARREGADOR",
    patrimony_number: overrides.patrimony_number ?? "PAT-001",
    serial_number: null,
    internal_code: "INT-001",
    category: overrides.category ?? "CARREGADOR",
    calibre: overrides.calibre ?? null,
    stock_quantity: overrides.stock_quantity ?? 1,
    status: overrides.status ?? "available",
    ...overrides,
  }
}

function ammo(overrides: Partial<PackAccessoryCandidate> = {}): PackAccessoryCandidate {
  return {
    id: overrides.id ?? "ammo-1",
    name: overrides.name ?? "MUNICAO 9MM",
    patrimony_number: overrides.patrimony_number ?? "MUN-001",
    serial_number: null,
    internal_code: "INT-002",
    category: overrides.category ?? "MUNICAO",
    calibre: overrides.calibre ?? null,
    stock_quantity: overrides.stock_quantity ?? 100,
    status: overrides.status ?? "available",
    ...overrides,
  }
}

describe("cautela-pack-accessories", () => {
  it("aceita carregador sem calibre cadastrado para arma 9mm", () => {
    expect(isChargerCompatibleWithWeapon(glockWeapon, charger({ calibre: null }))).toBe(true)
  })

  it("rejeita carregador com calibre explícito incompatível", () => {
    expect(isChargerCompatibleWithWeapon(glockWeapon, charger({ calibre: ".40" }))).toBe(false)
  })

  it("aceita munição sem calibre quando arma tem calibre", () => {
    expect(isAmmunitionCompatibleWithWeapon(glockWeapon, ammo({ calibre: null }))).toBe(true)
  })

  it("rejeita munição com calibre explícito incompatível", () => {
    expect(isAmmunitionCompatibleWithWeapon(glockWeapon, ammo({ calibre: ".45" }))).toBe(false)
  })

  it("buildPackAccessoryPool inclui Glock pool e carregadores compatíveis genéricos", () => {
    const glockChg = charger({
      id: "g1",
      patrimony_number: "PAT-GLK-POOL-001",
      name: "CARREGADOR GLOCK 9MM",
      calibre: "9mm",
    })
    const genericChg = charger({ id: "g2", patrimony_number: "PAT-GEN", calibre: null })
    const pool = buildPackAccessoryPool(glockWeapon, [glockChg, genericChg], "charger")
    expect(pool.map((m) => m.id)).toEqual(["g1", "g2"])
  })

  it("buildPackAccessoryPool usa compatíveis quando não há pool Glock", () => {
    const genericChg = charger({ id: "g2", patrimony_number: "PAT-GEN", calibre: null })
    const pool = buildPackAccessoryPool(glockWeapon, [genericChg], "charger")
    expect(pool).toHaveLength(1)
  })

  it("pickPackAccessoryForWeapon escolhe carregador sem calibre", () => {
    const picked = pickPackAccessoryForWeapon(glockWeapon, [charger({ calibre: null })], "charger")
    expect(picked?.id).toBe("chg-1")
  })

  it("filterPackCandidatesForWeapon não esvazia com carregadores sem calibre", () => {
    const list = filterPackCandidatesForWeapon(glockWeapon, [charger({ calibre: null })], "charger")
    expect(list).toHaveLength(1)
  })

  it("filterReservableMaterials exclui available com estoque zero", () => {
    const rows = filterReservableMaterials([
      { id: "a", status: "available", stock_quantity: 0 },
      { id: "b", status: "available", stock_quantity: 5 },
    ])
    expect(rows.map((r) => r.id)).toEqual(["b"])
  })
})
