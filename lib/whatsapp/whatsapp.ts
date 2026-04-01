// ========================================
// ARQUIVO: src/lib/whatsapp/whatsapp.ts
// ========================================

import { MensagemWhatsApp, ConfiguracaoSistema } from "@/types";

const DEFAULT_API_URL = "https://api.uazapi.dev/v1";

interface WhatsAppConfig {
  apiUrl?: string;
  phoneNumberId?: string;
  token?: string;
}

let config: WhatsAppConfig = {
  apiUrl: process.env.WHATSAPP_API_URL || DEFAULT_API_URL,
};

export function configureWhatsApp(newConfig: Partial<WhatsAppConfig>) {
  config = { ...config, ...newConfig };
}

export function getWhatsAppConfig(): WhatsAppConfig {
  return config;
}

export interface EnviarMensagemParams {
  to: string;
  tipo: "texto" | "documento" | "imagem";
  conteudo: string;
  nomeArquivo?: string;
  caption?: string;
}

export async function enviarMensagemWhatsApp(
  params: EnviarMensagemParams
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!config.token || !config.phoneNumberId) {
    return {
      success: false,
      error: "WhatsApp não configurado. Acesse Configurações para configurar.",
    };
  }

  try {
    const response = await fetch(`${config.apiUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: params.to.replace(/\D/g, ""),
        type: params.tipo,
        [params.tipo]: {
          ...(params.tipo === "texto" && { text: { body: params.conteudo } }),
          ...(params.tipo === "documento" && {
            document: {
              link: params.conteudo,
              filename: params.nomeArquivo,
            },
          }),
          ...(params.tipo === "imagem" && {
            image: {
              link: params.conteudo,
              caption: params.caption,
            },
          }),
        },
      }),
    });

    const data = await response.json();

    if (data.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id };
    }

    return { success: false, error: data.error?.message || "Erro ao enviar mensagem" };
  } catch (error) {
    return { success: false, error: "Erro de conexão com API do WhatsApp" };
  }
}

export async function verificarConexaoWhatsApp(): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!config.token) {
    return { success: false, error: "Token não configurado" };
  }

  try {
    const response = await fetch(`${config.apiUrl}/`, {
      headers: {
        Authorization: `Bearer ${config.token}`,
      },
    });

    if (response.ok) {
      return { success: true };
    }

    return { success: false, error: "Token inválido ou expirado" };
  } catch {
    return { success: false, error: "Erro de conexão" };
  }
}

export function formatarTelefone(telefone: string): string {
  const numeros = telefone.replace(/\D/g, "");
  
  if (numeros.length === 10) {
    return `+55${numeros}`;
  }
  if (numeros.length === 11) {
    return `+55${numeros}`;
  }
  if (numeros.length === 12) {
    return `+${numeros}`;
  }
  
  return telefone;
}

export function gerarLinkWebhook(webhookPath: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}${webhookPath}`;
  }
  return webhookPath;
}

export async function processarWebhook(
  payload: Record<string, unknown>
): Promise<MensagemWhatsApp | null> {
  const entry = (payload.entry as Array<Record<string, unknown>>)?.[0];
  const changes = (entry?.changes as Array<Record<string, unknown>>)?.[0];
  const value = changes?.value as Record<string, unknown>;
  const messages = value?.messages as Array<Record<string, unknown>>;

  if (!messages || messages.length === 0) {
    return null;
  }

  const msg = messages[0] as Record<string, unknown>;
  const from = msg.from as string;
  const messageType = msg.type as string;

  let conteudo = "";
  if (messageType === "text") {
    conteudo = (msg.text as Record<string, string>)?.body || "";
  } else if (messageType === "document") {
    const doc = msg.document as Record<string, string>;
    conteudo = `[Documento] ${doc?.filename || "arquivo"}`;
  } else if (messageType === "image") {
    conteudo = `[Imagem] ${(msg.image as Record<string, string>)?.caption || "imagem"}`;
  }

  const metadata = value?.metadata as Record<string, string>;

  return {
    id: crypto.randomUUID(),
    whatsapp_message_id: (msg.id as Record<string, string>)?.id || "",
    tipo: messageType as "texto" | "documento" | "imagem",
    conteudo,
    remetente: from,
    grupo_id: metadata?.phone_number_id || "",
    timestamp: new Date(),
    processada: false,
    escala_extraida: false,
    criado_em: new Date(),
  };
}
