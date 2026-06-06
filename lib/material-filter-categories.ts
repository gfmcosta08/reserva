/** Categorias esperadas nos filtros de /materials (ordenadas para exibição). */
export const CANONICAL_MATERIAL_CATEGORIES = [
  "ARMA CURTA",
  "ARMA LONGA",
  "PISTOLA",
  "CARREGADOR",
  "MUNIÇÃO",
  "COLETE",
  "CAPACETE",
  "CELULAR",
  "TRANSCEPTOR",
  "ALGEMA",
  "BORNAL",
  "IMPRESSORA",
  "TASER",
] as const

/** Chave de deduplicação: sem acento, minúsculas, singular simples (…s → …). */
export function categoryDedupeKey(name: string): string {
  let key = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
  if (key.length > 4 && key.endsWith("s")) key = key.slice(0, -1)
  return key
}

/** Rótulo preferido por chave de deduplicação. */
const PREFERRED_CATEGORY_LABEL: Record<string, string> = {
  municao: "MUNIÇÃO",
  capacete: "CAPACETE",
  colete: "COLETE",
  pistola: "PISTOLA",
  carregador: "CARREGADOR",
}

/** Normaliza categoria para gravação no banco (evita MUNICAO vs MUNIÇÃO, plural, etc.). */
export function canonicalizeMaterialCategory(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return trimmed
  const key = categoryDedupeKey(trimmed)
  return PREFERRED_CATEGORY_LABEL[key] ?? trimmed.toUpperCase()
}

/** Une categorias do banco com lista canônica, sem duplicatas (acento/plural). */
export function mergeMaterialCategoryOptions(dbNames: string[]): { name: string }[] {
  const byKey = new Map<string, string>()

  const add = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const key = categoryDedupeKey(trimmed)
    const preferred = PREFERRED_CATEGORY_LABEL[key] ?? trimmed
    if (!byKey.has(key)) byKey.set(key, preferred)
  }

  for (const c of CANONICAL_MATERIAL_CATEGORIES) add(c)
  for (const c of dbNames) add(c)

  const out = [...byKey.values()].sort((a, b) => a.localeCompare(b, "pt-BR"))
  return out.map((name) => ({ name }))
}
