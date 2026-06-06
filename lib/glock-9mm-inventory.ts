import { extractCaliber } from "@/lib/cautela-caliber"
import { categoryNameMatchesGroup } from "@/lib/cautela-material-groups"

export type GlockInventoryMaterial = {
  name?: string | null
  category?: string | null
  calibre?: string | null
  marca?: string | null
  patrimony_number?: string | null
  status?: string | null
}

export const GLK_POOL_PATRIMONY_PREFIX = "PAT-GLK-POOL-"

export function is9mmCaliber(material: GlockInventoryMaterial): boolean {
  const cal = (material.calibre || "").trim().toLowerCase()
  if (cal.includes("9mm") || cal === "9" || cal.includes("9 mm")) return true
  const fromName = extractCaliber(material.name || "") || extractCaliber(material.category || "")
  return fromName === "9mm"
}

export function isGlockBrand(material: GlockInventoryMaterial): boolean {
  const name = (material.name || "").toLowerCase()
  const marca = (material.marca || "").toLowerCase()
  return name.includes("glock") || marca.includes("glock")
}

export function isChargerMaterial(material: GlockInventoryMaterial): boolean {
  const cat = material.category || ""
  const name = material.name || ""
  return categoryNameMatchesGroup(cat, "charger") || categoryNameMatchesGroup(name, "charger")
}

export function isPistolWeapon(material: GlockInventoryMaterial): boolean {
  const cat = material.category || ""
  const name = material.name || ""
  return categoryNameMatchesGroup(cat, "pistol_weapon") || categoryNameMatchesGroup(name, "pistol_weapon")
}

/** Pistola Glock 9mm no inventário (arma, não carregador). */
export function isGlock9mmPistol(material: GlockInventoryMaterial): boolean {
  if (isChargerMaterial(material)) return false
  return isGlockBrand(material) && is9mmCaliber(material) && isPistolWeapon(material)
}

/** Carregador do pool Glock 9mm (categoria carregador + 9mm). */
export function isGlock9mmCharger(material: GlockInventoryMaterial): boolean {
  if (!isChargerMaterial(material)) return false
  const pat = (material.patrimony_number || "").toUpperCase()
  if (pat.startsWith(GLK_POOL_PATRIMONY_PREFIX)) return true
  return is9mmCaliber(material) || isGlockBrand(material)
}

export function targetChargerCount(pistolCount: number): number {
  /** Usado apenas pelo script QA sync-glock-charger-pool (teste_db), não pela Nova Cautela. */
  return Math.max(0, pistolCount * 3)
}

export function countPoolChargersByStatus(
  chargers: GlockInventoryMaterial[]
): { total: number; available: number; inUse: number; other: number } {
  const pool = chargers.filter(isGlock9mmCharger)
  let available = 0
  let inUse = 0
  let other = 0
  for (const c of pool) {
    if (c.status === "available") available++
    else if (c.status === "cautelado") inUse++
    else other++
  }
  return { total: pool.length, available, inUse, other }
}
