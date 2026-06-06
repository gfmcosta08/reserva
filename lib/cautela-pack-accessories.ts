import { areCalibersCompatible, extractCaliber } from "@/lib/cautela-caliber"
import { categoryNameMatchesGroup } from "@/lib/cautela-material-groups"

export type PackAccessoryCandidate = {
  id: string
  name: string
  patrimony_number: string
  serial_number: string | null
  internal_code: string
  category: string
  calibre: string | null
}

function weaponCaliber(weapon: { name: string; category: string; calibre?: string | null }): string | null {
  const fromField = weapon.calibre?.trim()
  if (fromField) return fromField
  return extractCaliber(weapon.name) || extractCaliber(weapon.category)
}

function materialCaliber(m: PackAccessoryCandidate): string | null {
  const fromField = m.calibre?.trim()
  if (fromField) return fromField
  return extractCaliber(m.name) || extractCaliber(m.category)
}

function matchesGroup(m: PackAccessoryCandidate, kind: "charger" | "ammunition"): boolean {
  const cat = m.category || ""
  const name = m.name || ""
  if (kind === "charger") {
    return categoryNameMatchesGroup(cat, "charger") || categoryNameMatchesGroup(name, "charger")
  }
  return categoryNameMatchesGroup(cat, "ammunition") || categoryNameMatchesGroup(name, "ammunition")
}

/** Filtro PostgREST: só carregadores ou só munição (evita .limit(300) sem trazer CARREGADOR). */
export function packAccessoryAvailabilityFilter(kind: "charger" | "ammunition"): string {
  if (kind === "charger") {
    return "category.ilike.%carregador%,category.ilike.%pente%,name.ilike.%carregador%,name.ilike.%pente%"
  }
  return "category.ilike.%municao%,category.ilike.%muni%,name.ilike.%municao%,name.ilike.%muni%,name.ilike.%cartucho%,name.ilike.%projetil%"
}

/** Escolhe o primeiro acessório disponível mais compatível com a arma (calibre / nome). */
export function pickPackAccessoryForWeapon(
  weapon: { name: string; category: string; calibre?: string | null },
  candidates: PackAccessoryCandidate[],
  kind: "charger" | "ammunition",
  excludeIds: string[] = []
): PackAccessoryCandidate | null {
  const exclude = new Set(excludeIds)
  const pool = candidates.filter((m) => matchesGroup(m, kind) && !exclude.has(m.id))
  if (pool.length === 0) return null

  const wCal = weaponCaliber(weapon)
  const weaponTokens = weapon.name.toLowerCase().split(/\s+/).filter((t) => t.length > 2)

  const scored = pool.map((m) => {
    let score = 0
    const mCal = materialCaliber(m)
    if (wCal && mCal && areCalibersCompatible(wCal, mCal)) score += 10
    const lower = m.name.toLowerCase()
    for (const t of weaponTokens) {
      if (lower.includes(t)) score += 2
    }
    if (wCal && lower.includes(wCal.toLowerCase().replace(/\./g, ""))) score += 3
    return { m, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.m ?? null
}

/** Até `count` acessórios distintos, excluindo IDs já escolhidos. */
export function pickPackAccessoriesForWeapon(
  weapon: { name: string; category: string; calibre?: string | null },
  candidates: PackAccessoryCandidate[],
  kind: "charger" | "ammunition",
  count: number
): PackAccessoryCandidate[] {
  const picked: PackAccessoryCandidate[] = []
  const exclude: string[] = []
  for (let i = 0; i < count; i++) {
    const one = pickPackAccessoryForWeapon(weapon, candidates, kind, exclude)
    if (!one) break
    picked.push(one)
    exclude.push(one.id)
  }
  return picked
}
