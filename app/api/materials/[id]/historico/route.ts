// ========================================
// ARQUIVO: src/app/api/materials/[id]/historico/route.ts
// ========================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { uuidSchema } from "@/lib/cautela-schemas";

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

  // Buscar todos os itens de cautela relacionados a este material
  const { data: items, error } = await supabase
    .from("cautela_items")
    .select(`
      *,
      cautela_id,
      materials(id, name),
      cautelum:cautelas(
        id,
        person_id,
        persons(full_name, rg)
      )
    `)
    .eq("material_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ historico: items || [] });
}
