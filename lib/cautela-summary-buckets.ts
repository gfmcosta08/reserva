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

export const BUCKET_TYPE_BADGE: Record<SummaryBucket, string> = {
  weapon: "Arma",
  charger: "Carregador",
  ammo: "Munição",
  other: "Outro",
}

export const BUCKET_ORDER: SummaryBucket[] = ["weapon", "charger", "ammo", "other"]

export function lineBucket(categoryName: string, materialName: string): SummaryBucket {
  return bucketForMaterialLine(categoryName, materialName)
}

export function groupByBucket<T extends { category_name?: string; material_name?: string }>(
  lines: T[]
): Record<SummaryBucket, T[]> {
  const groups: Record<SummaryBucket, T[]> = {
    weapon: [],
    charger: [],
    ammo: [],
    other: [],
  }
  for (const line of lines) {
    const b = lineBucket(line.category_name || "", line.material_name || "")
    groups[b].push(line)
  }
  return groups
}

/** Resumo de linhas pendentes por tipo, ex.: "1 arma, 2 carregadores, 0 munições" */
export function formatPendingBucketSummary(
  lines: { category_name?: string; material_name?: string; status?: string }[]
): string {
  const pending = lines.filter((l) => l.status === "pending")
  const counts: Record<SummaryBucket, number> = { weapon: 0, charger: 0, ammo: 0, other: 0 }
  for (const line of pending) {
    const b = lineBucket(line.category_name || "", line.material_name || "")
    counts[b] += 1
  }
  const parts: string[] = []
  if (counts.weapon) parts.push(`${counts.weapon} arma${counts.weapon > 1 ? "s" : ""}`)
  if (counts.charger)
    parts.push(`${counts.charger} carregador${counts.charger > 1 ? "es" : ""}`)
  if (counts.ammo) parts.push(`${counts.ammo} munição${counts.ammo > 1 ? "ões" : ""}`)
  if (counts.other) parts.push(`${counts.other} outro${counts.other > 1 ? "s" : ""}`)
  return parts.length ? parts.join(", ") : "nenhum item pendente"
}

export function hasOnlyWeaponInventory(
  lines: { category_name?: string; material_name?: string }[]
): boolean {
  if (lines.length !== 1) return false
  return lineBucket(lines[0].category_name || "", lines[0].material_name || "") === "weapon"
}
