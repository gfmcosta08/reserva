// ========================================
// ARQUIVO: src/lib/escalaParser.ts
// ========================================

import { EscalaServico } from "@/types";

interface ParseResult {
  escalas: Omit<EscalaServico, "id" | "criado_em">[];
  naoEncontrados: string[];
}

interface ParsedPessoa {
  nome: string;
  rg?: string;
  matricula?: string;
  dataServico?: string;
  horaInicio?: string;
  horaFim?: string;
}

const DATA_PATTERN = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/;
const HORA_PATTERN = /(\d{1,2})h?(\d{2})?\s*(?:às|ate|a|-)\s*(\d{1,2})h?(\d{2})?/i;
const NOME_RG_PATTERN = /^([A-Za-zÀ-ÖØ-öø-ÿ\s]+)(?:\s*[-–—]\s*|\s+)(?:RG[:\s]*)?(\d{[\.\-]?\d{3,9})/i;
const MATRICULA_PATTERN = /(?:mat(?:r(?:í|i)cula)?[:\s]*)?(\d{4,6})/i;

export function parseEscalaTexto(texto: string): ParseResult {
  const linhas = texto.split(/\n+/).filter((l) => l.trim());
  const escalas: Omit<EscalaServico, "id" | "criado_em">[] = [];
  const naoEncontrados: string[] = [];

  let dataServico = "";
  let horaInicio = "";
  let horaFim = "";

  for (const linha of linhas) {
    const dataMatch = linha.match(DATA_PATTERN);
    if (dataMatch) {
      const [, dia, mes, ano] = dataMatch;
      dataServico = `${ano.length === 2 ? "20" + ano : ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
      continue;
    }

    const horaMatch = linha.match(HORA_PATTERN);
    if (horaMatch) {
      const [, hi, mi = "00", , mf = "59"] = horaMatch;
      horaInicio = `${hi.padStart(2, "0")}:${mi}`;
      horaFim = `${mf.padStart(2, "0")}:00`;
      continue;
    }

    const nomeRgMatch = linha.match(NOME_RG_PATTERN);
    if (nomeRgMatch) {
      const nome = nomeRgMatch[1].trim();
      const rg = nomeRgMatch[2].replace(/[.\-]/g, "");

      const matriculaMatch = linha.match(MATRICULA_PATTERN);
      const matricula = matriculaMatch?.[1];

      if (nome && nome.length > 2) {
        escalas.push({
          pessoa_id: "",
          nome_identificado: nome,
          rg_identificado: rg,
          matricula_identificada: matricula || "",
          data_servico: dataServico ? new Date(dataServico) : new Date(),
          hora_inicio: horaInicio,
          hora_fim: horaFim,
          fonte: "whatsapp_grupo",
          documento_original: texto.substring(0, 1000),
          mensagem_whatsapp_id: null,
        });
      } else {
        naoEncontrados.push(linha);
      }
    } else {
      const nomeLimpo = linha.trim();
      if (nomeLimpo.length > 3 && !nomeLimpo.match(/^[0-9\s\-\/]+$/)) {
        const nomeOnlyMatch = nomeLimpo.match(/^([A-Za-zÀ-ÖØ-öø-ÿ\s]{5,50})/);
        if (nomeOnlyMatch) {
          escalas.push({
            pessoa_id: "",
            nome_identificado: nomeOnlyMatch[1].trim(),
            rg_identificado: "",
            matricula_identificada: "",
            data_servico: dataServico ? new Date(dataServico) : new Date(),
            hora_inicio: horaInicio,
            hora_fim: horaFim,
            fonte: "whatsapp_grupo",
            documento_original: texto.substring(0, 1000),
            mensagem_whatsapp_id: null,
          });
        } else {
          naoEncontrados.push(linha);
        }
      }
    }
  }

  return { escalas, naoEncontrados };
}

export function parseEscalaDocumento(
  textoDocumento: string,
  nomeArquivo?: string
): ParseResult {
  return parseEscalaTexto(textoDocumento);
}

export function extrairDataServico(texto: string): string | null {
  const dataMatch = texto.match(DATA_PATTERN);
  if (dataMatch) {
    const [, dia, mes, ano] = dataMatch;
    const anoCompleto = ano.length === 2 ? "20" + ano : ano;
    return `${anoCompleto}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
  }

  const hoje = new Date();
  const dataHoje = hoje.toISOString().split("T")[0];

  if (texto.toLowerCase().includes("hoje")) {
    return dataHoje;
  }
  if (texto.toLowerCase().includes("amanhã") || texto.toLowerCase().includes("amanha")) {
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    return amanha.toISOString().split("T")[0];
  }

  return dataHoje;
}

export function matchPessoaPorRG(
  rg: string,
  pessoas: { id: string; rg: string; nome: string }[]
): string | null {
  const rgLimpo = rg.replace(/[.\-]/g, "");
  const pessoa = pessoas.find(
    (p) => p.rg.replace(/[.\-]/g, "") === rgLimpo
  );
  return pessoa?.id || null;
}

export function matchPessoaPorMatricula(
  matricula: string,
  pessoas: { id: string; matricula: string; nome: string }[]
): string | null {
  const pessoa = pessoas.find((p) => 
    p.matricula.replace(/\s/g, "") === matricula.replace(/\s/g, "")
  );
  return pessoa?.id || null;
}
