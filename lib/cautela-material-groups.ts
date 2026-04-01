/**
 * Mapeamento de grupos de UI da cautela → palavras-chave nos NOMES de categorias no Supabase.
 * Ajuste os arrays se os nomes no seu banco forem diferentes (match parcial, case-insensitive).
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
  pistol_weapon: ["pistola", "arma curta", "revólver", "revolver", "glock"],
  long_weapon: ["arma longa", "fuzil", "carabina", "rifle", "metralhadora", "submetralhadora", "escopeta"],
  charger: ["carregador", "pente"],
  ammunition: ["munição", "municao", "cartucho", "projétil", "projetil", "balote"],
  vest_plate: ["colete", "placa", "balístico", "balistico"],
  radio_ht: ["rádio", "radio", "ht ", " ht", "comunicação", "comunicacao"],
  taser_equipment: ["taser", "eletrochoque"],
  taser_ammo: ["cartucho taser", "munição taser", "municao taser", "taser cartucho"],
  cellphone: ["celular", "smartphone", "telefone"],
  printer: ["impressora"],
}

export function categoryNameMatchesGroup(categoryName: string, group: CautelaMaterialGroup): boolean {
  const lower = categoryName.toLowerCase().trim()
  const keywords = GROUP_KEYWORDS[group]
  return keywords.some((k) => lower.includes(k.toLowerCase()))
}

export function resolveCategoryIdsForGroup(
  categories: { id: string; name: string }[],
  group: CautelaMaterialGroup
): string[] {
  return categories.filter((c) => categoryNameMatchesGroup(c.name, group)).map((c) => c.id)
}

/** Nome da categoria do material (primeiro elemento). */
export function isChargerCategoryName(categoryName: string): boolean {
  return categoryNameMatchesGroup(categoryName, "charger")
}
