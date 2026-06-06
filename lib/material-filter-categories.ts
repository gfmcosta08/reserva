/** Categorias esperadas nos filtros de /materials (ordenadas para exibição). */
export const CANONICAL_MATERIAL_CATEGORIES = [
  "ARMA CURTA",
  "ARMA LONGA",
  "PISTOLA",
  "CARREGADOR",
  "MUNICAO",
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

/** Une categorias do banco com lista canônica, sem duplicatas (case-insensitive). */
export function mergeMaterialCategoryOptions(dbNames: string[]): { name: string }[] {
  const seen = new Set<string>()
  const out: string[] = []

  const add = (name: string) => {
    const key = name.trim().toLowerCase()
    if (!key || seen.has(key)) return
    seen.add(key)
    out.push(name.trim())
  }

  for (const c of CANONICAL_MATERIAL_CATEGORIES) add(c)
  for (const c of dbNames) add(c)

  out.sort((a, b) => a.localeCompare(b, "pt-BR"))
  return out.map((name) => ({ name }))
}
