// ========================================
// ARQUIVO: src/app/api/autorizacoes-manuais/route.ts
// ========================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { logAudit } from "@/app/actions/audit";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const pessoaId = searchParams.get("pessoa_id");
  const cautelaId = searchParams.get("cautela_id");

  let query = supabase
    .from("autorizacoes_manuais")
    .select("*")
    .order("criado_em", { ascending: false });

  if (pessoaId) {
    query = query.eq("pessoa_id", pessoaId);
  }
  if (cautelaId) {
    query = query.eq("cautela_id", cautelaId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ autorizacoes: data || [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  
  try {
    const auth = await supabase.auth.getUser();
    if (!auth.data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    
    const { data, error } = await supabase
      .from("autorizacoes_manuais")
      .insert({
        pessoa_id: body.pessoa_id,
        cautela_id: body.cautela_id || null,
        motivo: body.motivo,
        anexo_base64: body.anexo_base64 || null,
        operador_id: auth.data.user.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log de auditoria
    await logAudit({
      action: "autorizacao_manual_criada",
      entity: "autorizacoes_manuais",
      entity_id: data.id,
      after_state: body,
    });

    return NextResponse.json({ success: true, autorizacao: data });
  } catch (error) {
    console.error("Error creating autorizacao:", error);
    return NextResponse.json({ error: "Erro ao criar autorização" }, { status: 500 });
  }
}
