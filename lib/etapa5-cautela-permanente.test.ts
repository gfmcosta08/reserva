import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  daysOverdueReview,
  daysUntilReview,
  isVistoriaOverdue,
  isVistoriaUpcoming,
} from "./cautela-vistoria"

const MIGRATION = join(
  process.cwd(),
  "supabase/migrations/20260609190000_etapa5_cautela_permanente_vistoria.sql"
)

describe("Etapa 5 cautela permanente / vistoria migration", () => {
  const sql = readFileSync(MIGRATION, "utf8")

  it("define calc_annual_review_date, registrar_vistoria e views de vistoria", () => {
    expect(sql).toMatch(/calc_annual_review_date/)
    expect(sql).toMatch(/registrar_vistoria/)
    expect(sql).toMatch(/v_vistorias_pendentes/)
    expect(sql).toMatch(/v_vistorias_atrasadas/)
    expect(sql).toMatch(/'VISTORIA'::public\.tipo_movimentacao/)
  })

  it("create_cautela_atomic grava review_date para permanent", () => {
    expect(sql).toMatch(/p_review_date/)
    expect(sql).toMatch(/review_date/)
  })
})

describe("cautela-vistoria helpers", () => {
  it("detecta vistoria atrasada e próxima", () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const inTenDays = new Date()
    inTenDays.setDate(inTenDays.getDate() + 10)

    expect(
      isVistoriaOverdue({
        type: "permanent",
        status: "open",
        review_date: yesterday.toISOString(),
      })
    ).toBe(true)

    expect(
      isVistoriaUpcoming({
        type: "permanent",
        status: "open",
        review_date: inTenDays.toISOString(),
      })
    ).toBe(true)

    expect(
      isVistoriaUpcoming({
        type: "daily",
        status: "open",
        review_date: inTenDays.toISOString(),
      })
    ).toBe(false)
  })

  it("calcula dias até vencimento e atraso", () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(12, 0, 0, 0)

    expect(daysUntilReview(tomorrow.toISOString())).toBeGreaterThanOrEqual(0)

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 3)
    expect(daysOverdueReview(yesterday.toISOString())).toBeGreaterThanOrEqual(3)
  })
})
