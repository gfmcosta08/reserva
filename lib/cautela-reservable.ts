/**
 * Filter materials that are reservable for cautela.
 * Stub — passes through all materials.
 *
 * NOTE: SearchableMaterial mirrors the type in app/actions/cautelas.ts
 * to avoid circular import (cautelas → cautela-reservable).
 */

export type SearchableMaterial = {
  id: string
  name: string
  patrimony_number: string
  serial_number: string | null
  internal_code: string
  category: string
  stock_quantity?: number
  [key: string]: unknown // allow extra fields
}

export function filterReservableMaterials<T extends SearchableMaterial>(
  materials: T[],
  _personId?: string
): T[] {
  return materials
}
