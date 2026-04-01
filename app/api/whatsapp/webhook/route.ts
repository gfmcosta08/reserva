// ========================================
// ARQUIVO: src/app/api/whatsapp/webhook/route.ts
// ========================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { processarWebhook } from "@/lib/whatsapp/whatsapp";
import { parseEscalaTexto } from "@/lib/escalaParser";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  // Verify webhook (Meta sends this to verify the endpoint)
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "reserva_webhook_verify";
  
  if (mode === "subscribe" && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  
  try {
    const body = await request.json();
    
    const mensagem = await processarWebhook(body);
    
    if (!mensagem) {
      return NextResponse.json({ success: true, message: "No messages to process" });
    }

    // Buscar ID do grupo de configurações
    const { data: config } = await supabase
      .from("configuracoes")
      .select("whatsapp_grupo_id")
      .limit(1)
      .single();

    const grupoId = config?.whatsapp_grupo_id || mensagem.grupo_id;

    // Salvar mensagem no banco
    const { data: msgSaved, error } = await supabase
      .from("mensagens_whatsapp")
      .insert({
        whatsapp_message_id: mensagem.whatsapp_message_id,
        tipo: mensagem.tipo,
        conteudo: mensagem.conteudo,
        remetente: mensagem.remetente,
        grupo_id: grupoId,
        timestamp: mensagem.timestamp,
        processada: false,
        escala_extraida: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Error saving message:", error);
    }

    // Se for documento ou texto, tentar extrair escala
    if (mensagem.tipo === "documento" || mensagem.tipo === "texto") {
      try {
        const { escalas, naoEncontrados } = parseEscalaTexto(mensagem.conteudo);
        
        if (escalas.length > 0 && msgSaved) {
          // Salvar cada entrada de escala
          for (const escala of escalas) {
            // Tentar encontrar a pessoa no banco
            let pessoaId: string | null = null;
            
            if (escala.rg_identificado) {
              const { data: pessoa } = await supabase
                .from("persons")
                .select("id")
                .eq("rg", escala.rg_identificado)
                .single();
              pessoaId = pessoa?.id || null;
            }
            
            if (!pessoaId && escala.matricula_identificada) {
              const { data: pessoa } = await supabase
                .from("persons")
                .select("id")
                .eq("registration_number", escala.matricula_identificada)
                .single();
              pessoaId = pessoa?.id || null;
            }

            await supabase.from("escala_servico").insert({
              pessoa_id: pessoaId,
              nome_identificado: escala.nome_identificado,
              rg_identificado: escala.rg_identificado || null,
              matricula_identificada: escala.matricula_identificada || null,
              data_servico: escala.data_servico,
              hora_inicio: escala.hora_inicio,
              hora_fim: escala.hora_fim,
              fonte: "whatsapp_grupo",
              documento_original: escala.documento_original,
              mensagem_whatsapp_id: msgSaved.id,
            });
          }

          // Marcar mensagem como processada
          await supabase
            .from("mensagens_whatsapp")
            .update({ processada: true, escala_extraida: true })
            .eq("id", msgSaved.id);
        }
      } catch (parseError) {
        console.error("Error parsing escala:", parseError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook processing error" }, { status: 500 });
  }
}
