/** Validação de calibre entre arma e munição (domínio cautela). */

export const CALIBER_PATTERNS = [
  { pattern: /9mm/i, caliber: "9mm" },
  { pattern: /\.40\b/i, caliber: ".40" },
  { pattern: /\.45\b/i, caliber: ".45" },
  { pattern: /\.38\b/i, caliber: ".38" },
  { pattern: /\.357\b/i, caliber: ".357" },
  { pattern: /\.380\b/i, caliber: ".380" },
  { pattern: /5\.7/i, caliber: "5.7" },
  { pattern: /7\.62/i, caliber: "7.62" },
  { pattern: /7\.62x51/i, caliber: "7.62x51" },
  { pattern: /12\s*gauge/i, caliber: "12" },
  { pattern: /\b12\b(?!mm)/i, caliber: "12" },
  { pattern: /16\s*gauge/i, caliber: "16" },
  { pattern: /20\s*gauge/i, caliber: "20" },
  { pattern: /\.223/i, caliber: ".223" },
  { pattern: /5\.56/i, caliber: "5.56" },
  { pattern: /6\.35/i, caliber: "6.35" },
  { pattern: /\.25\b/i, caliber: ".25" },
  { pattern: /\b9\.3\b/i, caliber: "9.3" },
] as const

const WEAPON_CATEGORIES = [
  "pistola",
  "revólver",
  "carabina",
  "escopeta",
  "submetralhadora",
  "rifle",
  "garrucha",
  " espingarda",
  "pistolete",
]

const AMMUNITION_KEYWORDS = ["munição", "municao", "cartucho", "balote", "projectil"]

export function isWeaponCategory(name: string): boolean {
  const lowerName = name.toLowerCase()
  return WEAPON_CATEGORIES.some((keyword) => lowerName.includes(keyword))
}

export function isAmmunitionCategory(name: string): boolean {
  const lowerName = name.toLowerCase()
  return AMMUNITION_KEYWORDS.some((keyword) => lowerName.includes(keyword))
}

export function extractCaliber(text: string): string | null {
  for (const { pattern, caliber } of CALIBER_PATTERNS) {
    if (pattern.test(text)) {
      return caliber
    }
  }
  return null
}

export function areCalibersCompatible(weaponCaliber: string, ammoCaliber: string): boolean {
  const w = weaponCaliber.toLowerCase().replace(/\s*/g, "")
  const a = ammoCaliber.toLowerCase().replace(/\s*/g, "")
  return w === a
}

export interface CaliberMismatch {
  materialId: string
  materialName: string
  ammoCaliber: string
  incompatibleWeapons: Array<{
    id: string
    name: string
    caliber: string
  }>
}

export type MaterialLike = {
  id: string
  name: string
  categories?: string
}

export function validateAmmunitionCaliber(selectedItems: MaterialLike[]): {
  incompatibilities: CaliberMismatch[]
  warnings: string[]
  selectedWeapon: MaterialLike | null
} {
  const incompatibilities: CaliberMismatch[] = []
  const warnings: string[] = []

  const selectedWeapons = selectedItems.filter((item) => {
    const categoryName = item.categories || ""
    return isWeaponCategory(categoryName) || isWeaponCategory(item.name)
  })

  const selectedAmmunition = selectedItems.filter((item) => {
    const categoryName = item.categories || ""
    return isAmmunitionCategory(categoryName) || isAmmunitionCategory(item.name)
  })

  if (selectedWeapons.length === 0 || selectedAmmunition.length === 0) {
    return { incompatibilities, warnings, selectedWeapon: null }
  }

  const primaryWeapon = selectedWeapons[0]
  const weaponName = primaryWeapon.categories || primaryWeapon.name
  const weaponCaliber = extractCaliber(weaponName) || extractCaliber(primaryWeapon.name)

  if (!weaponCaliber) {
    warnings.push(`Não foi possível identificar o calibre da arma ${primaryWeapon.name}`)
    return { incompatibilities, warnings, selectedWeapon: primaryWeapon }
  }

  for (const ammo of selectedAmmunition) {
    const ammoName = ammo.categories || ammo.name
    const ammoCaliber = extractCaliber(ammoName) || extractCaliber(ammo.name)

    if (!ammoCaliber) {
      warnings.push(`Não foi possível identificar o calibre da munição ${ammo.name}`)
      continue
    }

    if (!areCalibersCompatible(weaponCaliber, ammoCaliber)) {
      incompatibilities.push({
        materialId: ammo.id,
        materialName: ammo.name,
        ammoCaliber,
        incompatibleWeapons: [
          {
            id: primaryWeapon.id,
            name: primaryWeapon.name,
            caliber: weaponCaliber,
          },
        ],
      })
    }
  }

  return { incompatibilities, warnings, selectedWeapon: primaryWeapon }
}
