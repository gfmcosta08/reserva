// ========================================
// ARQUIVO: src/app/api/escala/route.ts
// ========================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const dataServico = searchParams.get("data");

  let query = supabase
    .from("escala_servico")
    .select("*")
    .order("hora_inicio", { ascending: true });

  if (dataServico) {
    query = query.eq("data_servico", dataServico);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ escalas: data || [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  
  try {
    const body = await request.json();
    
    const { data, error } = await supabase
      .from("escala_servico")
      .insert({
        pessoa_id: body.pessoa_id || null,
        nome_identificado: body.nome_identificado,
        rg_identificado: body.rg_identificado || null,
        matricula_identificada: body.matricula_identificada || null,
        data_servico: body.data_servico,
        hora_inicio: body.hora_inicio,
        hora_fim: body.hora_fim,
        fonte: body.fonte || "manual",
        documento_original: body.documento_original || null,
        mensagem_whatsapp_id: body.mensagem_whatsapp_id || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, escala: data });
  } catch (error) {
    console.error("Error creating escala:", error);
    return NextResponse.json({ error: "Erro ao criar escala" }, { status: 500 });
  }
}
