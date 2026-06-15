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
  return weapon.calibre ?? null
}

export function weaponAccessoryContext(weapon: PackWeaponContext) {
  return { calibre: weaponCaliber(weapon) }
}

export function isGlockPoolCharger(m: PackAccessoryCandidate): boolean {
  return m.patrimony_number.startsWith(GLK_POOL_PATRIMONY_PREFIX)
}

export function isChargerCompatibleWithWeapon(
  weapon: PackWeaponContext,
  charger: PackAccessoryCandidate
): boolean {
  const cal = weaponCaliber(weapon)
  if (!cal) return true
  return charger.calibre === cal
}

export function isAmmunitionCompatibleWithWeapon(
  weapon: PackWeaponContext,
  ammo: PackAccessoryCandidate
): boolean {
  const cal = weaponCaliber(weapon)
  if (!cal) return true
  return ammo.calibre === cal
}

export function filterPackCandidatesForWeapon(
  weapon: PackWeaponContext,
  candidates: PackAccessoryCandidate[]
): PackAccessoryCandidate[] {
  return candidates.filter((c) => {
    if (isAmmunitionCategory(c.category)) {
      return isAmmunitionCompatibleWithWeapon(weapon, c)
    }
    return isChargerCompatibleWithWeapon(weapon, c)
  })
}

export function packAccessoryAvailabilityFilter(kind: "charger" | "ammunition"): string {
  return kind === "charger" ? "cautelado" : "available"
}

export type PackAccessoryLineMergeTarget = {
  materialId: string
  category: string
  materialName: string
  packWeaponId?: string
}

export function findPackAccessoryMergeLineIndex(
  rows: PackAccessoryLineMergeTarget[],
  target: PackAccessoryLineMergeTarget
): number {
  return rows.findIndex(
    (r) =>
      r.materialId === target.materialId &&
      r.category === target.category &&
      r.materialName === target.materialName &&
      (target.packWeaponId === undefined || r.packWeaponId === target.packWeaponId)
  )
}

export function pickPackAccessoryForWeapon(
  weapon: PackWeaponContext,
  candidates: PackAccessoryCandidate[],
  kind: "charger" | "ammunition"
): PackAccessoryCandidate | null {
  const filtered = filterPackCandidatesForWeapon(weapon, candidates)
  return filtered[0] ?? null
}

export function buildPackAccessoryPool(
  weapon: any,
  candidates: PackAccessoryCandidate[],
  kind: string
): PackAccessoryCandidate[] {
  const filtered = filterPackCandidatesForWeapon(weapon, candidates)
  return filtered
}

export async function fetchReservablePackAccessories(
  _supabase: any,
  _kind: string
): Promise<PackAccessoryCandidate[]> {
  return []
}

export function pickPackAccessoriesForWeapon(
  weapon: PackWeaponContext,
  candidates: PackAccessoryCandidate[],
  kind: "charger" | "ammunition",
  count: number,
  excludeIds: string[] = []
): { selected: PackAccessoryCandidate[]; remaining: PackAccessoryCandidate[] } {
  return { selected: [], remaining: candidates }
}
