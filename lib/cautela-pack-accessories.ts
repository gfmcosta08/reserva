import { areCalibersCompatible, extractCaliber, isAmmunitionCategory } from "@/lib/cautela-caliber"
import { categoryNameMatchesGroup } from "@/lib/cautela-material-groups"
import {
  GLK_POOL_PATRIMONY_PREFIX,
  isGlock9mmCharger,
  isGlock9mmPistol,
} from "@/lib/glock-9mm-inventory"

export type PackWeaponContext = {
  name: string
  category: string
  calibre?: string | null
  marca?: string | null
  modelo?: string | null
}

export type PackAccessoryCandidate = {
  id: string
  name: string
  patrimony_number: string
  serial_number: string | null
  internal_code: string
  category: string
  calibre: string | null
  marca?: string | null
  modelo?: string | null
  stock_quantity?: number | null
}

function weaponCaliber(weapon: PackWeaponContext): string | null {
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

export function weaponAccessoryContext(weapon: PackWeaponContext) {
  return {
    caliber: weaponCaliber(weapon),
    marca: weapon.marca?.trim() || null,
    modelo: weapon.modelo?.trim() || null,
    nameTokens: weapon.name.toLowerCase().split(/\s+/).filter((t) => t.length > 2),
  }
}

export function isGlockPoolCharger(m: PackAccessoryCandidate): boolean {
  const pat = (m.patrimony_number || "").toUpperCase()
  return pat.startsWith(GLK_POOL_PATRIMONY_PREFIX)
}

export function isChargerCompatibleWithWeapon(
  weapon: PackWeaponContext,
  m: PackAccessoryCandidate
): boolean {
  if (!matchesGroup(m, "charger")) return false
  if (!isGlock9mmPistol(weapon)) {
    if (isGlockPoolCharger(m) || isGlock9mmCharger(m)) return false
  }
  const wCal = weaponCaliber(weapon)
  if (wCal) {
    const mCal = materialCaliber(m)
    if (!mCal || !areCalibersCompatible(wCal, mCal)) return false
  }
  return true
}

export function isAmmunitionCompatibleWithWeapon(
  weapon: PackWeaponContext,
  m: PackAccessoryCandidate
): boolean {
  if (!matchesGroup(m, "ammunition")) return false
  const wCal = weaponCaliber(weapon)
  if (!wCal) return true
  const mCal = materialCaliber(m)
  return mCal != null && areCalibersCompatible(wCal, mCal)
}

export function filterPackCandidatesForWeapon(
  weapon: PackWeaponContext,
  candidates: PackAccessoryCandidate[],
  kind: "charger" | "ammunition"
): PackAccessoryCandidate[] {
  const predicate =
    kind === "charger" ? isChargerCompatibleWithWeapon : isAmmunitionCompatibleWithWeapon
  return candidates.filter((m) => predicate(weapon, m))
}

/** Filtro PostgREST: só carregadores ou só munição (evita .limit(300) sem trazer CARREGADOR). */
export function packAccessoryAvailabilityFilter(kind: "charger" | "ammunition"): string {
  if (kind === "charger") {
    return "category.ilike.%carregador%,category.ilike.%pente%,name.ilike.%carregador%,name.ilike.%pente%"
  }
  return "category.ilike.%municao%,category.ilike.%muni%,name.ilike.%municao%,name.ilike.%muni%,name.ilike.%cartucho%,name.ilike.%projetil%"
}

export type PackAccessoryLineMergeTarget = {
  materialId: string
  category: string
  materialName: string
  packWeaponId?: string
}

/** Índice da linha que pode receber qty extra (munição de pacotes distintos não funde). */
export function findPackAccessoryMergeLineIndex(
  prev: PackAccessoryLineMergeTarget[],
  next: PackAccessoryLineMergeTarget
): number {
  const isAmmo =
    isAmmunitionCategory(next.category) || isAmmunitionCategory(next.materialName)
  return prev.findIndex((x) => {
    if (x.materialId !== next.materialId) return false
    if (isAmmo) {
      return (x.packWeaponId ?? "") === (next.packWeaponId ?? "")
    }
    return true
  })
}

function scoreAccessoryForWeapon(
  weapon: PackWeaponContext,
  m: PackAccessoryCandidate,
  wCal: string | null,
  weaponTokens: string[]
): number {
  let score = 0
  const mCal = materialCaliber(m)
  if (wCal && mCal && areCalibersCompatible(wCal, mCal)) score += 10
  const lower = m.name.toLowerCase()
  for (const t of weaponTokens) {
    if (lower.includes(t)) score += 2
  }
  if (wCal && lower.includes(wCal.toLowerCase().replace(/[.,]/g, ""))) score += 3
  const wMarca = weapon.marca?.trim().toLowerCase()
  const mMarca = m.marca?.trim().toLowerCase()
  if (wMarca && mMarca && wMarca === mMarca) score += 5
  const wModelo = weapon.modelo?.trim().toLowerCase()
  const mModelo = m.modelo?.trim().toLowerCase()
  if (wModelo && mModelo && wModelo === mModelo) score += 5
  return score
}

/** Escolhe o primeiro acessório disponível mais compatível com a arma (calibre / marca / modelo). */
export function pickPackAccessoryForWeapon(
  weapon: PackWeaponContext,
  candidates: PackAccessoryCandidate[],
  kind: "charger" | "ammunition",
  excludeIds: string[] = []
): PackAccessoryCandidate | null {
  const exclude = new Set(excludeIds)
  let pool = candidates.filter((m) => matchesGroup(m, kind) && !exclude.has(m.id))
  if (pool.length === 0) return null

  const wCal = weaponCaliber(weapon)
  if (wCal) {
    const compatible = pool.filter((m) => {
      const mCal = materialCaliber(m)
      return mCal != null && areCalibersCompatible(wCal, mCal)
    })
    if (compatible.length === 0) return null
    pool = compatible
  }

  const { nameTokens } = weaponAccessoryContext(weapon)

  const scored = pool.map((m) => ({
    m,
    score: scoreAccessoryForWeapon(weapon, m, wCal, nameTokens),
  }))

  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.m ?? null
}

/** Até `count` acessórios distintos, excluindo IDs já escolhidos. */
export function pickPackAccessoriesForWeapon(
  weapon: PackWeaponContext,
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
