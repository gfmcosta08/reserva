import { createClient } from "@/lib/supabase-server"
import { NextRequest, NextResponse } from "next/server"
import { logAudit } from "@/app/actions/audit"

// ===== API: PROCESSAR DEVOLUÇÃO DE ITEM =====
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Obter operador logado
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 })
    }

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
      .select("id, material_id, cautela_id, status, quantity_delivered")
      .eq("id", cautela_item_id)
      .single()

    if (itemError || !item) {
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 })
    }

    if (item.status !== "pending") {
      return NextResponse.json({ error: "Este item já foi processado" }, { status: 400 })
    }

    // Validar quantidade
    const qtyReturned = quantity_returned ?? item.quantity_delivered ?? 1
    const qtyDelivered = item.quantity_delivered || 1

    if (qtyReturned < 0 || qtyReturned > qtyDelivered) {
      return NextResponse.json(
        { error: `Quantidade inválida. Deve estar entre 0 e ${qtyDelivered}` },
        { status: 400 }
      )
    }

    // Para danificado/extraviado, quantidade devolvida é 0
    const finalQtyReturned = (status === "damaged" || status === "missing") ? 0 : qtyReturned

    // Atualizar item
    const { error: updateItemError } = await supabase
      .from("cautela_items")
      .update({
        status,
        quantity_returned: finalQtyReturned,
        notes: notes || null,
        returned_at: new Date().toISOString(),
        returned_by: user.id
      })
      .eq("id", cautela_item_id)

    if (updateItemError) {
      return NextResponse.json({ error: updateItemError.message }, { status: 500 })
    }

    // Atualizar status do material
    let materialStatus: string
    switch (status) {
      case "returned":
        if (finalQtyReturned === qtyDelivered) {
          materialStatus = "available"
        } else {
          materialStatus = "pending_return" // Devolução parcial - aguarda conferência
        }
        break
      case "damaged":
        materialStatus = "maintenance"
        break
      case "missing":
        materialStatus = "unavailable"
        break
      default:
        materialStatus = "available"
    }

    await supabase
      .from("materials")
      .update({ status: materialStatus })
      .eq("id", item.material_id)

    // Verificar se todos os itens da cautela foram processados
    const { data: allItems } = await supabase
      .from("cautela_items")
      .select("status, quantity_delivered, quantity_returned")
      .eq("cautela_id", item.cautela_id)

    const allDone = allItems?.every(i => i.status !== "pending")

    if (allDone) {
      // Verificar se há divergências
      const hasDivergence = allItems?.some(i =>
        i.status === "damaged" ||
        i.status === "missing" ||
        (i.quantity_returned !== undefined && i.quantity_returned < (i.quantity_delivered || 1))
      )

      const cautelaStatus = hasDivergence ? "divergent" : "closed"
      await supabase
        .from("cautelas")
        .update({
          status: cautelaStatus,
          closed_at: new Date().toISOString()
        })
        .eq("id", item.cautela_id)
    } else {
      // Marcar como parcial se pelo menos um foi devolvido
      const someReturned = allItems?.some(i => i.status !== "pending")
      if (someReturned) {
        await supabase
          .from("cautelas")
          .update({ status: "partial" })
          .eq("id", item.cautela_id)
      }
    }

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
      },
      user_id: user.id
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
