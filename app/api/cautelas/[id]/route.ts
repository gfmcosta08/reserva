// ========================================
// ARQUIVO: src/app/api/cautelas/[id]/route.ts
// ========================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { uuidSchema } from "@/lib/cautela-schemas";

function isMissingCategoriesColumnError(error: { message?: string } | null) {
  const message = error?.message ?? "";
  return /column .*categories.* does not exist/i.test(message);
}

function normalizeCategory(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "Sem Categoria";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: cautela, error } = await supabase
    .from("cautelas")
    .select(`
      *,
      persons(id, full_name, rg, registration_number, function, status, 
              rg_front_url, rg_back_url, phone, email, foto_rg_frente, foto_rg_verso),
      profiles(name, email)
    `)
    .eq("id", id)
    .single();

  if (error || !cautela) {
    return NextResponse.json({ error: "Cautela não encontrada" }, { status: 404 });
  }

  // Buscar itens com dados do material
  let { data: items, error: itemsError } = await supabase
    .from("cautela_items")
    .select(`
      *,
      materials(id, name, patrimony_number, serial_number, internal_code, 
                caliber, subcategoria, categories)
    `)
    .eq("cautela_id", id);

  if (itemsError && isMissingCategoriesColumnError(itemsError)) {
    const fallback = await supabase
      .from("cautela_items")
      .select(`
        *,
        materials(id, name, patrimony_number, serial_number, internal_code, 
                  caliber, subcategoria, category)
      `)
      .eq("cautela_id", id);
    items = fallback.data;
    itemsError = fallback.error;
  }

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  const normalizedItems = (items || []).map((item: any) => ({
    ...item,
    materials: item.materials
      ? {
          ...item.materials,
          categories: normalizeCategory(item.materials?.categories ?? item.materials?.category),
        }
      : item.materials,
  }));

  return NextResponse.json({ 
    cautela,
    items: normalizedItems 
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const supabase = await createClient();
  
  try {
    const body = await request.json();
    const { action, ...data } = body;

    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    switch (action) {
      case "renew": {
        // Renovar cautela
        const newExpiresAt = data.days 
          ? new Date(Date.now() + data.days * 24 * 60 * 60 * 1000).toISOString()
          : data.expires_at;

        const { error } = await supabase
          .from("cautelas")
          .update({ 
            expires_at: newExpiresAt,
            renewed_at: new Date().toISOString(),
            renewed_by: user.id,
          })
          .eq("id", id);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ success: true, expires_at: newExpiresAt });
      }

      case "close": {
        // Fechar cautela
        const { data: items } = await supabase
          .from("cautela_items")
          .select("id, material_id, quantity_delivered")
          .eq("cautela_id", id);

        if (items) {
          for (const item of items) {
            // Atualizar status do item
            await supabase
              .from("cautela_items")
              .update({ 
                status: "returned",
                quantity_returned: item.quantity_delivered,
                returned_at: new Date().toISOString(),
                returned_by: user.id,
              })
              .eq("id", item.id);

            // Devolver material ao estoque
            await supabase.rpc("increment_material_available", {
              material_id: item.material_id,
              amount: item.quantity_delivered || 1,
            });
          }
        }

        const { error } = await supabase
          .from("cautelas")
          .update({ 
            status: "closed",
            closed_at: new Date().toISOString(),
          })
          .eq("id", id);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ success: true });
      }

      case "add_item": {
        // Adicionar item
        const { material_id, quantidade } = data;

        const { error } = await supabase
          .from("cautela_items")
          .insert({
            cautela_id: id,
            material_id,
            quantity_delivered: quantidade || 1,
            status: "pending",
          });

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ success: true });
      }

      case "remove_item": {
        // Remover item
        const { item_id } = data;

        const { error } = await supabase
          .from("cautela_items")
          .delete()
          .eq("id", item_id)
          .eq("status", "pending");

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: "Ação desconhecida" }, { status: 400 });
    }
  } catch (error) {
    console.error("Cautela PATCH error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
