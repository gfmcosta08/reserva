/** Espelha lib/glock-9mm-inventory.ts para scripts .mjs (somente QA/sync). */

export const GLK_POOL_PATRIMONY_PREFIX = "PAT-GLK-POOL-"

const PISTOL_KW = ["pistola", "arma curta", "revólver", "revolver", "glock"]
const CHARGER_KW = ["carregador", "pente"]

function includesKw(text, keywords) {
  const lower = String(text ?? "").toLowerCase()
  return keywords.some((k) => lower.includes(k))
}

export function is9mmCaliber(m) {
  const cal = String(m.calibre ?? "").toLowerCase()
  if (cal.includes("9mm") || cal === "9" || cal.includes("9 mm")) return true
  const name = String(m.name ?? "").toLowerCase()
  return /\b9\s*mm\b/i.test(name) || name.includes("9mm")
}

export function isGlockBrand(m) {
  const name = String(m.name ?? "").toLowerCase()
  const marca = String(m.marca ?? "").toLowerCase()
  return name.includes("glock") || marca.includes("glock")
}

export function isChargerMaterial(m) {
  return includesKw(m.category, CHARGER_KW) || includesKw(m.name, CHARGER_KW)
}

export function isPistolWeapon(m) {
  return includesKw(m.category, PISTOL_KW) || includesKw(m.name, PISTOL_KW)
}

export function isGlock9mmPistol(m) {
  if (isChargerMaterial(m)) return false
  return isGlockBrand(m) && is9mmCaliber(m) && isPistolWeapon(m)
}

export function isGlock9mmCharger(m) {
  if (!isChargerMaterial(m)) return false
  const pat = String(m.patrimony_number ?? "").toUpperCase()
  if (pat.startsWith(GLK_POOL_PATRIMONY_PREFIX)) return true
  return is9mmCaliber(m) || isGlockBrand(m)
}

/** Alvo de seed QA: 3 carregadores por pistola Glock 9mm (não é regra de runtime). */
export function targetChargerCount(pistolCount) {
  return Math.max(0, pistolCount * 3)
}

export function countPoolChargersByStatus(chargers) {
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
