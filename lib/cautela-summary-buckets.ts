import { isWeaponCategory, isAmmunitionCategory } from "@/lib/cautela-caliber"
import { isChargerCategoryName } from "@/lib/cautela-material-groups"

export type SummaryBucket = "weapon" | "charger" | "ammo" | "other"

export function bucketForMaterialLine(categoryName: string, materialName: string): SummaryBucket {
  if (isWeaponCategory(categoryName) || isWeaponCategory(materialName)) return "weapon"
  if (isAmmunitionCategory(categoryName) || isAmmunitionCategory(materialName)) return "ammo"
  if (isChargerCategoryName(categoryName)) return "charger"
  return "other"
}

export const BUCKET_LABEL: Record<SummaryBucket, string> = {
  weapon: "Armas",
  charger: "Carregadores",
  ammo: "Munição / projéteis",
  other: "Demais itens",
}
