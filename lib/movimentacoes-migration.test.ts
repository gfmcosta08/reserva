import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const MIGRATION = join(
  process.cwd(),
  "supabase/migrations/20260609170000_etapa3_movimentacoes.sql"
)

describe("Etapa 3 movimentacoes migration", () => {
  const sql = readFileSync(MIGRATION, "utf8")

  it("cria tabela movimentacoes e ENUM tipo_movimentacao", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.movimentacoes/)
    expect(sql).toMatch(/tipo_movimentacao/)
  })

  it("revoga UPDATE/DELETE em movimentacoes", () => {
    expect(sql).toMatch(/REVOKE UPDATE, DELETE ON public\.movimentacoes/)
  })

  it("define aplicar_movimentacao_material e registrar_movimentacao_devolucao", () => {
    expect(sql).toMatch(/aplicar_movimentacao_material/)
    expect(sql).toMatch(/registrar_movimentacao_devolucao/)
  })

  it("create_cautela_atomic usa aplicar_movimentacao_material", () => {
    expect(sql).toMatch(/PERFORM public\.aplicar_movimentacao_material/)
  })
})
