import { createClient } from "@/lib/supabase-server"
import { NextRequest, NextResponse } from "next/server"
import { logAudit } from "@/app/actions/audit"
import { requireApiCautelaOperator } from "@/lib/api-auth"
import {
  computeCautelaStatus,
  itemNeedsReturn,
  qtyReturned,
  resolveItemStatusAfterReturn,
} from "@/lib/cautela-return-status"
import { computeMaterialAfterReturn } from "@/lib/material-stock"

// ===== API: PROCESSAR DEVOLUÇÃO DE ITEM =====
export async function POST(request: NextRequest) {
  try {
    const guard = await requireApiCautelaOperator()
    if ("response" in guard) return guard.response

    const supabase = await createClient()
    const { user } = guard.auth

    const body = await request.json()
    const { cautela_item_id, status, quantity_returned, notes } = body

    // Validar campos obrigatórios
    if (!cautela_item_id || !status) {
      return NextResponse.json(
        { error: "campos obrigatórios: cautela_item_id, status" },
        { status: 400 }
      )
    }

    // Validar status
    const validStatuses = ["returned", "damaged", "missing"]
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Status inválido" }, { status: 400 })
    }

    // Buscar item
    const { data: item, error: itemError } = await supabase
      .from("cautela_items")
      .select("id, material_id, cautela_id, status, quantity_delivered, quantity_returned")
      .eq("id", cautela_item_id)
      .single()

    if (itemError || !item) {
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 })
    }

    if (!itemNeedsReturn(item)) {
      return NextResponse.json(
        { error: "Este item já foi processado ou não possui saldo pendente" },
        { status: 400 }
      )
    }

    const qtyDelivered = item.quantity_delivered || 1
    const previousReturned = qtyReturned(item)
    const qtyReturnedNew =
      status === "damaged" || status === "missing"
        ? 0
        : (quantity_returned ?? qtyDelivered)

    if (qtyReturnedNew < previousReturned) {
      return NextResponse.json(
        {
          error: `Quantidade devolvida não pode ser menor que o já registrado (${previousReturned})`,
        },
        { status: 400 }
      )
    }

    if (qtyReturnedNew < 0 || qtyReturnedNew > qtyDelivered) {
      return NextResponse.json(
        { error: `Quantidade inválida. Deve estar entre 0 e ${qtyDelivered}` },
        { status: 400 }
      )
    }

    const finalQtyReturned = status === "damaged" || status === "missing" ? 0 : qtyReturnedNew
    const itemStatus =
      status === "damaged" || status === "missing"
        ? status
        : resolveItemStatusAfterReturn(finalQtyReturned, qtyDelivered)
    const now = new Date().toISOString()

    const { error: updateItemError } = await supabase
      .from("cautela_items")
      .update({
        status: itemStatus,
        quantity_returned: finalQtyReturned,
        notes: notes || null,
        returned_at: now,
        returned_by: user.id,
      })
      .eq("id", cautela_item_id)

    if (updateItemError) {
      return NextResponse.json({ error: updateItemError.message }, { status: 500 })
    }

    const { data: materialRow } = await supabase
      .from("materials")
      .select("stock_quantity")
      .eq("id", item.material_id)
      .single()

    const stockUpdate = computeMaterialAfterReturn(
      materialRow?.stock_quantity ?? 1,
      previousReturned,
      finalQtyReturned,
      itemStatus as "pending" | "returned" | "damaged" | "missing",
      qtyDelivered
    )
    await supabase
      .from("materials")
      .update({ stock_quantity: stockUpdate.stock_quantity, status: stockUpdate.status })
      .eq("id", item.material_id)

    const { data: allItems } = await supabase
      .from("cautela_items")
      .select("status, quantity_delivered, quantity_returned")
      .eq("cautela_id", item.cautela_id)

    const cautelaStatus = computeCautelaStatus(allItems || [])
    const closedAt = cautelaStatus === "closed" || cautelaStatus === "divergent" ? now : null

    await supabase
      .from("cautelas")
      .update({ status: cautelaStatus, closed_at: closedAt })
      .eq("id", item.cautela_id)

    // Audit log
    const auditAction = status === "returned" ? "item_returned" : status === "damaged" ? "item_damaged" : "item_missing"
    await logAudit({
      action: auditAction,
      entity: "cautela_items",
      entity_id: cautela_item_id,
      after_state: {
        status,
        quantity_returned: finalQtyReturned,
        quantity_delivered: qtyDelivered,
        material_id: item.material_id,
        cautela_id: item.cautela_id
      }
    })

    return NextResponse.json({
      success: true,
      item_id: cautela_item_id,
      status,
      quantity_returned: finalQtyReturned
    })

  } catch (error: any) {
    console.error("Erro na API cautela-return:", error)
    return NextResponse.json({ error: error.message || "Erro interno" }, { status: 500 })
  }
}
