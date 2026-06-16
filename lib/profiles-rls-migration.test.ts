import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const MIGRATION = join(
  process.cwd(),
  "supabase/migrations/20260608130000_profiles_rbac_rls.sql"
)

describe("SEC-05 profiles RBAC migration", () => {
  const sql = readFileSync(MIGRATION, "utf8")

  it("remove políticas permissivas legadas em profiles", () => {
    expect(sql).toMatch(/DROP POLICY IF EXISTS "profiles_operator_rw"/)
    expect(sql).toMatch(/DROP POLICY IF EXISTS "Allow authenticated users"/)
  })

  it("define is_supervisor() com SECURITY DEFINER", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.is_supervisor\(\)/)
    expect(sql).toMatch(/SECURITY DEFINER/)
    expect(sql).toMatch(/p\.role = 'supervisor'/)
  })

  it("restringe escrita em profiles a supervisores", () => {
    expect(sql).toMatch(/profiles_supervisor_insert/)
    expect(sql).toMatch(/profiles_supervisor_update/)
    expect(sql).toMatch(/profiles_supervisor_delete/)
    expect(sql).not.toMatch(/profiles_operator_rw.*FOR ALL/)
  })

  it("mantém leitura para operadores ativos (UI cautelas/relatórios)", () => {
    expect(sql).toMatch(/profiles_operator_select/)
    expect(sql).toMatch(/is_active_operator\(\)/)
  })
})
