/** Status canônico do material (Etapa 2 — alinhado ao ENUM Postgres `status_material`). */

export const STATUS_MATERIAL_VALUES = [
  "DISPONIVEL",
  "CAUTELADO_TEMPORARIO",
  "CAUTELADO_PERMANENTE",
  "MANUTENCAO",
  "BLOQUEADO",
  "BAIXADO",
  "EXTRAVIADO",
  "PENDENTE_DEVOLUCAO",
] as const

export type StatusMaterial = (typeof STATUS_MATERIAL_VALUES)[number]

export const TIPO_MATERIAL_VALUES = [
  "ARMA_CURTA",
  "ARMA_LONGA",
  "CARREGADOR",
  "MUNICAO",
  "COLETE",
  "CAPACETE",
  "CELULAR",
  "TRANSCEPTOR",
  "ALGEMA",
  "BORNAL",
  "IMPRESSORA",
  "TASER",
  "OUTRO",
] as const

export type TipoMaterial = (typeof TIPO_MATERIAL_VALUES)[number]

const LEGACY_TO_ENUM: Record<string, StatusMaterial> = {
  available: "DISPONIVEL",
  in_use: "CAUTELADO_TEMPORARIO",
  cautelado: "CAUTELADO_TEMPORARIO",
  maintenance: "MANUTENCAO",
  blocked: "BLOQUEADO",
  unavailable: "BAIXADO",
  pending_return: "PENDENTE_DEVOLUCAO",
}

const ENUM_TO_LEGACY: Record<StatusMaterial, string> = {
  DISPONIVEL: "available",
  CAUTELADO_TEMPORARIO: "cautelado",
  CAUTELADO_PERMANENTE: "cautelado",
  MANUTENCAO: "maintenance",
  BLOQUEADO: "blocked",
  BAIXADO: "unavailable",
  EXTRAVIADO: "unavailable",
  PENDENTE_DEVOLUCAO: "pending_return",
}

export function legacyStatusToEnum(status: string | null | undefined): StatusMaterial {
  if (!status) return "DISPONIVEL"
  return LEGACY_TO_ENUM[status] ?? "DISPONIVEL"
}

export function enumStatusToLegacy(status: StatusMaterial): string {
  return ENUM_TO_LEGACY[status] ?? "available"
}

export function resolveMaterialStatus(m: {
  status_atual?: StatusMaterial | string | null
  status?: string | null
}): StatusMaterial {
  if (m.status_atual && STATUS_MATERIAL_VALUES.includes(m.status_atual as StatusMaterial)) {
    return m.status_atual as StatusMaterial
  }
  return legacyStatusToEnum(m.status)
}

export function isStatusDisponivel(m: {
  status_atual?: StatusMaterial | string | null
  status?: string | null
}): boolean {
  return resolveMaterialStatus(m) === "DISPONIVEL"
}

export function statusMaterialLabel(status: StatusMaterial): string {
  const labels: Record<StatusMaterial, string> = {
    DISPONIVEL: "Disponível",
    CAUTELADO_TEMPORARIO: "Cautelado (temporário)",
    CAUTELADO_PERMANENTE: "Cautelado (permanente)",
    MANUTENCAO: "Manutenção",
    BLOQUEADO: "Bloqueado",
    BAIXADO: "Baixado",
    EXTRAVIADO: "Extraviado",
    PENDENTE_DEVOLUCAO: "Pendente devolução",
  }
  return labels[status] ?? status
}

export function categoryToTipoMaterial(category: string | null | undefined): TipoMaterial {
  const key = (category ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, "_")
    .replace(/Ç/g, "C")

  const map: Record<string, TipoMaterial> = {
    ARMA_CURTA: "ARMA_CURTA",
    PISTOLA: "ARMA_CURTA",
    ARMA_LONGA: "ARMA_LONGA",
    CARREGADOR: "CARREGADOR",
    MUNICAO: "MUNICAO",
    COLETE: "COLETE",
    CAPACETE: "CAPACETE",
    CELULAR: "CELULAR",
    TRANSCEPTOR: "TRANSCEPTOR",
    ALGEMA: "ALGEMA",
    BORNAL: "BORNAL",
    IMPRESSORA: "IMPRESSORA",
    TASER: "TASER",
  }
  return map[key] ?? "OUTRO"
}
