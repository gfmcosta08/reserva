/**
 * Mapeamento de grupos da UI de cautela para palavras-chave em `materials.categories`.
 */
export type CautelaMaterialGroup =
  | "pistol_weapon"
  | "long_weapon"
  | "charger"
  | "ammunition"
  | "vest_plate"
  | "radio_ht"
  | "taser_equipment"
  | "taser_ammo"
  | "cellphone"
  | "printer"

const GROUP_KEYWORDS: Record<CautelaMaterialGroup, string[]> = {
  pistol_weapon: ["pistola", "arma curta", "revolver", "glock"],
  long_weapon: ["arma longa", "fuzil", "carabina", "rifle", "metralhadora", "submetralhadora", "escopeta"],
  charger: ["carregador", "pente"],
  ammunition: ["municao", "cartucho", "projetil", "balote"],
  vest_plate: ["colete", "placa", "balistico"],
  radio_ht: ["radio", "ht ", " ht", "comunicacao"],
  taser_equipment: ["taser", "eletrochoque"],
  taser_ammo: ["cartucho taser", "municao taser", "taser cartucho"],
  cellphone: ["celular", "smartphone", "telefone"],
  printer: ["impressora"],
}

export function categoryNameMatchesGroup(categoryName: string, group: CautelaMaterialGroup): boolean {
  const lower = categoryName.toLowerCase().trim()
  const keywords = GROUP_KEYWORDS[group]
  return keywords.some((k) => lower.includes(k.toLowerCase()))
}

export function resolveCategoryNamesForGroup(
  categories: string[],
  group: CautelaMaterialGroup
): string[] {
  return categories.filter((categoryName) => categoryNameMatchesGroup(categoryName, group))
}

export function isChargerCategoryName(categoryName: string): boolean {
  return categoryNameMatchesGroup(categoryName, "charger")
}

