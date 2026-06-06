"use server"

import { createClient } from "@/lib/supabase-server"
import { revalidatePath } from "next/cache"
import { requireCautelaOperator } from "@/lib/auth-cautela"

export type AmmoBatch = {
  id: string
  calibre: string
  marca: string | null
  quantity_total: number
  quantity_available: number
  lot_number: string | null
  acquisition_date: string | null
  expiry_date: string | null
  notes: string | null
  created_at: string
  created_by: string | null
  profiles?: { name: string } | null
}

export async function getAmmoBatches(): Promise<AmmoBatch[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("ammo_batches")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return (data || []) as AmmoBatch[]
}

export async function createAmmoBatch(data: {
  calibre: string
  marca?: string
  quantity_total: number
  lot_number?: string
  acquisition_date?: string
  expiry_date?: string
  notes?: string
}) {
  const auth = await requireCautelaOperator()
  if ("error" in auth) return { error: auth.error }

  const supabase = await createClient()

  const { error } = await supabase.from("ammo_batches").insert({
    calibre: data.calibre.trim(),
    marca: data.marca?.trim() || null,
    quantity_total: data.quantity_total,
    quantity_available: data.quantity_total,
    lot_number: data.lot_number?.trim() || null,
    acquisition_date: data.acquisition_date || null,
    expiry_date: data.expiry_date || null,
    notes: data.notes?.trim() || null,
    created_by: auth.user.id,
  })

  if (error) return { error: error.message }

  revalidatePath("/ammo-batches")
  return { success: true }
}

export async function updateAmmoBatch(
  id: string,
  data: Partial<{
    calibre: string
    marca: string
    quantity_total: number
    quantity_available: number
    lot_number: string
    acquisition_date: string
    expiry_date: string
    notes: string
  }>
) {
  const auth = await requireCautelaOperator()
  if ("error" in auth) return { error: auth.error }

  const supabase = await createClient()

  const updatePayload: Record<string, any> = {}
  if (data.calibre !== undefined) updatePayload.calibre = data.calibre.trim()
  if (data.marca !== undefined) updatePayload.marca = data.marca.trim() || null
  if (data.quantity_total !== undefined) updatePayload.quantity_total = data.quantity_total
  if (data.quantity_available !== undefined) updatePayload.quantity_available = data.quantity_available
  if (data.lot_number !== undefined) updatePayload.lot_number = data.lot_number.trim() || null
  if (data.acquisition_date !== undefined) updatePayload.acquisition_date = data.acquisition_date || null
  if (data.expiry_date !== undefined) updatePayload.expiry_date = data.expiry_date || null
  if (data.notes !== undefined) updatePayload.notes = data.notes.trim() || null

  const { error } = await supabase.from("ammo_batches").update(updatePayload).eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/ammo-batches")
  return { success: true }
}

export async function deleteAmmoBatch(id: string) {
  const auth = await requireCautelaOperator()
  if ("error" in auth) return { error: auth.error }

  const supabase = await createClient()

  // Only allow deletion if no ammo has been used
  const { data: batch, error: fetchError } = await supabase
    .from("ammo_batches")
    .select("id, quantity_total, quantity_available")
    .eq("id", id)
    .single()

  if (fetchError || !batch) return { error: "Lote não encontrado" }

  if (batch.quantity_available !== batch.quantity_total) {
    return { error: "Não é possível excluir um lote com munição já utilizada" }
  }

  const { error } = await supabase.from("ammo_batches").delete().eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/ammo-batches")
  return { success: true }
}
