/** Seções do dashboard por perfil (Etapa 7). */

export type DashboardProfile = "operator" | "supervisor"

export function resolveDashboardProfile(role: string): DashboardProfile {
  return role === "supervisor" ? "supervisor" : "operator"
}

export function dashboardProfileLabel(profile: DashboardProfile): string {
  return profile === "supervisor" ? "Supervisor" : "Operador de reserva"
}

export function canAccessSupervisorReports(role: string): boolean {
  return role === "supervisor"
}
