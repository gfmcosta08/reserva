// ========================================
// ARQUIVO: src/app/api/configuracoes/route.ts
// ========================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("configuracoes")
    .select("*")
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ config: data || null });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  
  try {
    const body = await request.json();
    
    // Verificar se já existe configuração
    const { data: existing } = await supabase
      .from("configuracoes")
      .select("id")
      .limit(1)
      .single();

    let result;
    
    if (existing) {
      // Atualizar
      const { data, error } = await supabase
        .from("configuracoes")
        .update({
          whatsapp_numero: body.whatsapp_numero || null,
          whatsapp_api_token: body.whatsapp_api_token || null,
          whatsapp_grupo_id: body.whatsapp_grupo_id || null,
          email_api_url: body.email_api_url || null,
          email_api_token: body.email_api_token || null,
          email_remetente: body.email_remetente || null,
          nome_orgao: body.nome_orgao || "Organização de Segurança",
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();
      
      result = data;
    } else {
      // Criar
      const { data, error } = await supabase
        .from("configuracoes")
        .insert({
          whatsapp_numero: body.whatsapp_numero || null,
          whatsapp_api_token: body.whatsapp_api_token || null,
          whatsapp_grupo_id: body.whatsapp_grupo_id || null,
          email_api_url: body.email_api_url || null,
          email_api_token: body.email_api_token || null,
          email_remetente: body.email_remetente || null,
          nome_orgao: body.nome_orgao || "Organização de Segurança",
        })
        .select()
        .single();
      
      result = data;
    }

    return NextResponse.json({ success: true, config: result });
  } catch (error) {
    console.error("Error saving config:", error);
    return NextResponse.json({ error: "Erro ao salvar configuração" }, { status: 500 });
  }
}
