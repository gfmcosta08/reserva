import {
  resolveMaterialStatus,
  statusMaterialLabel,
  type StatusMaterial,
} from "@/lib/material-status"

export type DailyCautelaRow = {
  type: string
  status: string
  created_at?: string
  data_prevista_devolucao?: string | null
}

/** Cautela diária aberta/parcial com prazo de devolução ultrapassado. */
export function isDailyCautelaOverdue(cautela: DailyCautelaRow, now = new Date()): boolean {
  if (cautela.type !== "daily") return false
  if (!["open", "partial"].includes(cautela.status)) return false

  if (cautela.data_prevista_devolucao) {
    return new Date(cautela.data_prevista_devolucao) < now
  }

  if (!cautela.created_at) return false
  const created = new Date(cautela.created_at)
  return created.toDateString() !== now.toDateString()
}

export function resolveMaterialDisplayStatus(m: {
  status_atual?: StatusMaterial | string | null
  status?: string | null
}): string {
  return statusMaterialLabel(resolveMaterialStatus(m))
}

export const STATUS_MATERIAL_BADGE_COLORS: Record<StatusMaterial, string> = {
  DISPONIVEL: "bg-green-500/10 text-green-500",
  CAUTELADO_TEMPORARIO: "bg-blue-500/10 text-blue-500",
  CAUTELADO_PERMANENTE: "bg-indigo-500/10 text-indigo-400",
  MANUTENCAO: "bg-amber-500/10 text-amber-500",
  BLOQUEADO: "bg-red-500/10 text-red-500",
  BAIXADO: "bg-slate-500/10 text-slate-400",
  EXTRAVIADO: "bg-orange-500/10 text-orange-400",
  PENDENTE_DEVOLUCAO: "bg-yellow-500/10 text-yellow-400",
}

export function statusMaterialBadgeColor(m: {
  status_atual?: StatusMaterial | string | null
  status?: string | null
}): string {
  const status = resolveMaterialStatus(m)
  return STATUS_MATERIAL_BADGE_COLORS[status] ?? STATUS_MATERIAL_BADGE_COLORS.DISPONIVEL
}
