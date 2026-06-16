import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { isDailyCautelaOverdue, resolveMaterialDisplayStatus } from "./cautela-daily"

const MIGRATION = join(
  process.cwd(),
  "supabase/migrations/20260609181000_etapa4_cautela_temporaria.sql"
)

describe("Etapa 4 cautela temporária migration", () => {
  const sql = readFileSync(MIGRATION, "utf8")

  it("adiciona data_prevista_devolucao e view de materiais em cautela aberta", () => {
    expect(sql).toMatch(/data_prevista_devolucao/)
    expect(sql).toMatch(/v_materiais_cautela_temporaria_aberta/)
    expect(sql).toMatch(/calc_daily_return_deadline/)
  })

  it("create_cautela_atomic grava prazo para daily e usa CAUTELA_SAIDA via aplicar_movimentacao", () => {
    expect(sql).toMatch(/data_prevista_devolucao/)
    expect(sql).toMatch(/CAUTELA_SAIDA/)
    expect(sql).toMatch(/aplicar_movimentacao_material/)
  })
})

describe("cautela-daily helpers", () => {
  it("detecta cautela diária atrasada pelo prazo", () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    expect(
      isDailyCautelaOverdue({
        type: "daily",
        status: "open",
        data_prevista_devolucao: yesterday.toISOString(),
      })
    ).toBe(true)
    expect(
      isDailyCautelaOverdue({
        type: "daily",
        status: "closed",
        data_prevista_devolucao: yesterday.toISOString(),
      })
    ).toBe(false)
  })

  it("resolve rótulo de status priorizando status_atual", () => {
    expect(
      resolveMaterialDisplayStatus({ status_atual: "CAUTELADO_TEMPORARIO", status: "available" })
    ).toBe("Cautelado (temporário)")
  })
})
