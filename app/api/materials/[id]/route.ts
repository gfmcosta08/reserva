// ========================================
// ARQUIVO: src/app/api/materials/[id]/route.ts
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

  const { data: material, error } = await supabase
    .from("materials")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !material) {
    return NextResponse.json({ error: "Material não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ material });
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
    
    const { data, error } = await supabase
      .from("materials")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ material: data });
  } catch (error) {
    console.error("Material PATCH error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
