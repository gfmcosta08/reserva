// ========================================
// ARQUIVO: src/app/api/persons/[id]/route.ts
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

  const { data: person, error } = await supabase
    .from("persons")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !person) {
    return NextResponse.json({ error: "Pessoa não encontrada" }, { status: 404 });
  }

  return NextResponse.json({ person });
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
    
    // Campos permitidos para update
    const allowedFields = [
      "full_name", "email", "rg", "registration_number", "function",
      "status", "phone", "cpf", "rg_front_url", "rg_back_url", "foto_facial"
    ];
    
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("persons")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ person: data });
  } catch (error) {
    console.error("Person PATCH error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
