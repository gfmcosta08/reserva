import { describe, expect, it } from "vitest"
import { sanitizeIlikeFragment } from "./search-sanitize"

describe("VULN-sanitize: filtros de busca", () => {
  it("remove % para evitar wildcard amplo em ilike", () => {
    expect(sanitizeIlikeFragment("a%b%c", 20)).toBe("abc")
  })

  it("limita tamanho (DoS)", () => {
    const long = "x".repeat(500)
    expect(sanitizeIlikeFragment(long, 10).length).toBe(10)
  })
})
