// ========================================
// ARQUIVO: src/lib/schemas.ts
// ========================================

import { z } from "zod";

// ============ NOVAS VALIDAÇÕES ============

export const uuidSchema = z.string().uuid({ message: "Formato de ID inválido" });

export const pessoaSchema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  rg: z.string().min(5, "RG obrigatório"),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "CPF inválido"),
  matricula: z.string().min(3, "Matrícula obrigatória"),
  funcao: z.string().min(2, "Função obrigatória"),
  telefone: z.string().min(8, "Telefone obrigatório"),
  email: z.string().email("E-mail inválido"),
  pin: z.string().regex(/^\d{6}$/, "PIN deve ter 6 dígitos"),
  status: z.enum(["ativo", "inativo"]),
  foto_rg_frente: z.string().optional(),
  foto_rg_verso: z.string().optional(),
  foto_facial: z.string().optional(),
});

export const createPessoaInputSchema = pessoaSchema;

export const updatePessoaInputSchema = pessoaSchema.partial().extend({
  id: uuidSchema,
});

export const materialSchema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  patrimonio: z.string().min(1, "Patrimônio obrigatório"),
  numero_serie: z.string().optional(),
  codigo_interno: z.string().min(1, "Código interno obrigatório"),
  categoria_id: uuidSchema,
  subcategoria: z.string(),
  calibre: z.string().optional(),
  quantidade_total: z.number().int().min(0),
  quantidade_disponivel: z.number().int().min(0),
  status: z.enum(["disponivel", "cautelado", "manutencao", "indisponivel", "baixado"]),
  observacoes: z.string().optional(),
});

export const createMaterialInputSchema = materialSchema;

export const updateMaterialInputSchema = materialSchema.partial().extend({
  id: uuidSchema,
});

export const createCautelaInputSchema = z.object({
  person_id: uuidSchema,
  type: z.enum(["diaria", "permanente"]),
  items: z.array(z.object({
    material_id: uuidSchema,
    quantidade: z.number().int().min(1).optional().default(1),
    opcoes: z.object({
      tipo_bastao: z.enum(["bastao", "tonfa"]).optional(),
      algema_com_chave: z.boolean().optional(),
      placa_com_capa: z.boolean().optional(),
      descricao_diverso: z.string().optional(),
    }).optional(),
  })).min(1, "Selecione pelo menos um material"),
  notes: z.string().max(2000).optional(),
  expected_return_date: z.string().optional(),
  pin: z.string().regex(/^\d{6}$/, "PIN deve ter 6 dígitos").optional(),
  autenticacao_tipo: z.enum(["pin", "facial"]).optional(),
});

export const createAutorizacaoManualSchema = z.object({
  pessoa_id: uuidSchema,
  cautela_id: uuidSchema.optional(),
  motivo: z.string().min(10, "Motivo obrigatório (mínimo 10 caracteres)"),
  anexo_base64: z.string().optional(),
});

export const createEscalaServicoSchema = z.object({
  pessoa_id: uuidSchema.optional(),
  nome_identificado: z.string().min(2, "Nome obrigatório"),
  rg_identificado: z.string().optional(),
  matricula_identificada: z.string().optional(),
  data_servico: z.string(),
  hora_inicio: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
  hora_fim: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
  fonte: z.enum(["whatsapp_grupo", "manual"]),
  documento_original: z.string().optional(),
  mensagem_whatsapp_id: z.string().optional(),
});

export const createConfiguracaoSchema = z.object({
  whatsapp_numero: z.string().optional(),
  whatsapp_api_token: z.string().optional(),
  whatsapp_grupo_id: z.string().optional(),
  email_api_url: z.string().url().optional(),
  email_api_token: z.string().optional(),
  email_remetente: z.string().email().optional(),
  nome_orgao: z.string().optional(),
});

export const devolutionItemSchema = z.object({
  cautelaItemId: uuidSchema,
  status: z.enum(["devolvido", "danificado", "extraviado"]),
  quantityReturned: z.number().optional(),
  notes: z.string().optional(),
});

export const processDevolutionInputSchema = z.object({
  cautelaId: uuidSchema,
  items: z.array(devolutionItemSchema).min(1),
});

export const validatePinInputSchema = z.object({
  pessoa_id: uuidSchema,
  pin: z.string().regex(/^\d{6}$/, "PIN deve ter 6 dígitos"),
});

export const processarMensagemWhatsAppSchema = z.object({
  mensagem_id: uuidSchema,
});

export const renovarCautelaInputSchema = z.object({
  cautela_id: uuidSchema,
  novos_dias: z.number().int().min(1).max(365).optional(),
  nova_data: z.string().optional(),
  pin: z.string().regex(/^\d{6}$/, "PIN deve ter 6 dígitos"),
});
