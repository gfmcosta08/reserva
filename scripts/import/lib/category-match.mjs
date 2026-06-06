/** Espelha keywords de lib/cautela-material-groups e lib/cautela-caliber (scripts .mjs). */

export function isWeaponCategoryName(name) {
  const lower = String(name ?? "").toLowerCase()
  const keywords = [
    "pistola",
    "revólver",
    "revolver",
    "carabina",
    "escopeta",
    "submetralhadora",
    "rifle",
    "garrucha",
    "espingarda",
    "pistolete",
    "arma longa",
    "arma curta",
    "fuzil",
    "glock",
    "metralhadora",
  ]
  return keywords.some((k) => lower.includes(k))
}

export function isChargerCategoryName(name) {
  const lower = String(name ?? "").toLowerCase()
  return ["carregador", "pente"].some((k) => lower.includes(k))
}
