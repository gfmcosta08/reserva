import { describe, expect, it } from "vitest"
import {
  canonicalizeMaterialCategory,
  categoryDedupeKey,
  mergeMaterialCategoryOptions,
} from "./material-filter-categories"

describe("material-filter-categories", () => {
  it("canonicalizeMaterialCategory mapeia PISTOLA para ARMA CURTA", () => {
    expect(canonicalizeMaterialCategory("PISTOLA")).toBe("ARMA CURTA")
    expect(canonicalizeMaterialCategory("pistola")).toBe("ARMA CURTA")
    expect(canonicalizeMaterialCategory("PISTOLAS")).toBe("ARMA CURTA")
  })

  it("categoryDedupeKey unifica pistola e arma curta", () => {
    expect(categoryDedupeKey("PISTOLA")).toBe("arma curta")
    expect(categoryDedupeKey("ARMA CURTA")).toBe("arma curta")
  })

  it("mergeMaterialCategoryOptions não duplica PISTOLA e ARMA CURTA", () => {
    const opts = mergeMaterialCategoryOptions(["PISTOLA", "ARMA CURTA", "CARREGADOR"])
    const names = opts.map((o) => o.name)
    expect(names.filter((n) => n === "ARMA CURTA")).toHaveLength(1)
    expect(names).not.toContain("PISTOLA")
  })
})
