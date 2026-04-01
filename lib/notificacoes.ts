// ========================================
// ARQUIVO: src/lib/notificacoes.ts
// ========================================

import { DadosNotificacaoCautela, ConfiguracaoSistema } from "@/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { enviarMensagemWhatsApp, formatarTelefone } from "./whatsapp/whatsapp";

const DEFAULT_EMAIL_API_URL = "https://api.resend.com";
const DEFAULT_EMAIL_FROM = "Sistema RESERVA <noreply@reserva.gov.br>";

interface NotificacaoConfig {
  emailApiUrl?: string;
  emailToken?: string;
  emailFrom?: string;
  nomeOrgao?: string;
}

let config: NotificacaoConfig = {
  emailApiUrl: process.env.EMAIL_API_URL || DEFAULT_EMAIL_API_URL,
  emailToken: process.env.EMAIL_TOKEN,
  emailFrom: process.env.EMAIL_FROM || DEFAULT_EMAIL_FROM,
  nomeOrgao: process.env.NOME_ORGAO || "Organização de Segurança",
};

export function configurarNotificacoes(newConfig: Partial<NotificacaoConfig>) {
  config = { ...config, ...newConfig };
}

export function getNotificacaoConfig(): NotificacaoConfig {
  return config;
}

export function gerarMensagemWhatsApp(dados: DadosNotificacaoCautela): string {
  const { cautela, pessoa, itens, operador_nome } = dados;

  const dataAbertura = format(new Date(cautela.data_abertura), "dd/MM/yyyy", { locale: ptBR });
  const horaAbertura = format(new Date(cautela.data_abertura), "HH:mm", { locale: ptBR });
  
  const dataDevolucao = cautela.data_prevista_devolucao
    ? format(new Date(cautela.data_prevista_devolucao), "dd/MM/yyyy", { locale: ptBR })
    : "Sem prazo definido";

  const listaItens = itens
    .map((item) => {
      const nome = item.material?.nome || "Material";
      const qtd = item.quantidade > 1 ? ` (${item.quantidade} unidades)` : "";
      return `• ${nome}${qtd}`;
    })
    .join("\n");

  const autenticacao = cautela.autenticacao_tipo === "pin" ? "PIN" : "Identificação facial";

  return `*CAUTELA REGISTRADA — ${config.nomeOrgao}*

Olá, ${pessoa.nome}.

Sua cautela foi registrada com sucesso.

📋 *Resumo:*
- Data: ${dataAbertura}
- Hora: ${horaAbertura}
- Tipo: ${cautela.tipo === "diaria" ? "Diária" : "Permanente"}
- Devolução prevista: ${dataDevolucao}
- Autenticação: ${autenticacao}

📦 *Materiais cautelados:*
${listaItens}

Em caso de dúvidas, procure o setor responsável.`;
}

export function gerarCorpoEmail(dados: DadosNotificacaoCautela): string {
  const { cautela, pessoa, itens } = dados;

  const dataAbertura = format(new Date(cautela.data_abertura), "dd/MM/yyyy", { locale: ptBR });
  const horaAbertura = format(new Date(cautela.data_abertura), "HH:mm", { locale: ptBR });
  
  const dataDevolucao = cautela.data_prevista_devolucao
    ? format(new Date(cautela.data_prevista_devolucao), "dd/MM/yyyy", { locale: ptBR })
    : "Sem prazo definido";

  const listaItens = itens
    .map((item) => {
      const nome = item.material?.nome || "Material";
      const qtd = item.quantidade > 1 ? ` (${item.quantidade} unidades)` : "";
      return `<li>${nome}${qtd}</li>`;
    })
    .join("");

  const autenticacao = cautela.autenticacao_tipo === "pin" ? "PIN" : "Identificação facial";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
    .content { background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; }
    .item { background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border: 1px solid #e2e8f0; }
    .label { font-weight: 600; color: #64748b; font-size: 12px; text-transform: uppercase; }
    .value { font-size: 16px; color: #1e293b; margin-top: 4px; }
    .footer { background: #1e293b; color: #94a3b8; padding: 20px; text-align: center; border-radius: 0 0 12px 12px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">CAUTELA REGISTRADA</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">${config.nomeOrgao}</p>
    </div>
    <div class="content">
      <p>Olá, <strong>${pessoa.nome}</strong>.</p>
      <p>Sua cautela foi registrada com sucesso.</p>
      
      <div class="item">
        <div class="label">Data</div>
        <div class="value">${dataAbertura}</div>
      </div>
      <div class="item">
        <div class="label">Hora</div>
        <div class="value">${horaAbertura}</div>
      </div>
      <div class="item">
        <div class="label">Tipo</div>
        <div class="value">${cautela.tipo === "diaria" ? "Diária" : "Permanente"}</div>
      </div>
      <div class="item">
        <div class="label">Devolução prevista</div>
        <div class="value">${dataDevolucao}</div>
      </div>
      <div class="item">
        <div class="label">Autenticação</div>
        <div class="value">${autenticacao}</div>
      </div>
      <div class="item">
        <div class="label">Materiais cautelados</div>
        <div class="value">
          <ul style="margin: 0; padding-left: 20px;">${listaItens}</ul>
        </div>
      </div>
    </div>
    <div class="footer">
      <p>Em caso de dúvidas, procure o setor responsável.</p>
      <p>${config.nomeOrgao} • ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
    </div>
  </div>
</body>
</html>`;
}

export async function enviarNotificacaoCautela(
  dados: DadosNotificacaoCautela
): Promise<{
  whatsapp: { success: boolean; error?: string };
  email: { success: boolean; error?: string };
}> {
  const results = {
    whatsapp: { success: false as boolean, error: "" as string },
    email: { success: false as boolean, error: "" as string },
  };

  // Enviar WhatsApp
  try {
    const telefoneFormatado = formatarTelefone(dados.pessoa.telefone);
    const mensagem = gerarMensagemWhatsApp(dados);

    const resultado = await enviarMensagemWhatsApp({
      to: telefoneFormatado,
      tipo: "texto",
      conteudo: mensagem,
    });

    results.whatsapp = {
      success: resultado.success,
      error: resultado.error || undefined,
    };
  } catch (error) {
    results.whatsapp = {
      success: false,
      error: "Erro ao enviar WhatsApp",
    };
  }

  // Enviar E-mail
  try {
    if (!config.emailToken) {
      results.email = {
        success: false,
        error: "E-mail não configurado",
      };
    } else {
      const corpo = gerarCorpoEmail(dados);

      const response = await fetch(`${config.emailApiUrl}/emails`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.emailToken}`,
        },
        body: JSON.stringify({
          from: config.emailFrom,
          to: dados.pessoa.email,
          subject: `Cautela registrada — ${format(new Date(), "dd/MM/yyyy")}`,
          html: corpo,
        }),
      });

      const data = await response.json();

      results.email = {
        success: response.ok,
        error: data.error || undefined,
      };
    }
  } catch (error) {
    results.email = {
      success: false,
      error: "Erro ao enviar e-mail",
    };
  }

  return results;
}

export async function testarEnvioEmail(
  email: string
): Promise<{ success: boolean; error?: string }> {
  if (!config.emailToken) {
    return { success: false, error: "Token de e-mail não configurado" };
  }

  try {
    const response = await fetch(`${config.emailApiUrl}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.emailToken}`,
      },
      body: JSON.stringify({
        from: config.emailFrom,
        to: email,
        subject: "Teste - Sistema RESERVA",
        html: "<p>Teste de configuração de e-mail. Se você recebeu esta mensagem, a configuração está funcionando.</p>",
      }),
    });

    if (response.ok) {
      return { success: true };
    }

    const data = await response.json();
    return { success: false, error: data.error || "Erro ao enviar teste" };
  } catch {
    return { success: false, error: "Erro de conexão" };
  }
}
