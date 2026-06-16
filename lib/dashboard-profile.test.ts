import { describe, expect, it } from "vitest"
import {
  canAccessSupervisorReports,
  dashboardProfileLabel,
  resolveDashboardProfile,
} from "./dashboard-profile"

describe("dashboard-profile", () => {
  it("resolve perfis", () => {
    expect(resolveDashboardProfile("supervisor")).toBe("supervisor")
    expect(resolveDashboardProfile("operator")).toBe("operator")
  })

  it("rotula perfis", () => {
    expect(dashboardProfileLabel("supervisor")).toBe("Supervisor")
    expect(dashboardProfileLabel("operator")).toBe("Operador de reserva")
  })

  it("restringe relatórios ampliados", () => {
    expect(canAccessSupervisorReports("supervisor")).toBe(true)
    expect(canAccessSupervisorReports("operator")).toBe(false)
  })
})
