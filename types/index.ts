// ========================================
// ARQUIVO: src/types/index.ts
// ========================================

import { z } from "zod"

// ============ PESSOA ============
export interface Pessoa {
  id: string;
  nome: string;
  rg: string;
  cpf: string;
  matricula: string;
  funcao: string;
  foto_rg_frente: string | null;
  foto_rg_verso: string | null;
  foto_facial: string | null;
  pin_hash: string;
  pin_bloqueado_ate: Date | null;
  tentativas_pin: number;
  status: 'ativo' | 'inativo';
  telefone: string;
  email: string;
  criado_em: Date;
  atualizado_em: Date;
}

export const pessoaSchema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  rg: z.string().min(5, "RG obrigatório"),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "CPF inválido"),
  matricula: z.string().min(3, "Matrícula obrigatória"),
  funcao: z.string().min(2, "Função obrigatória"),
  telefone: z.string().min(8, "Telefone obrigatório"),
  email: z.string().email("E-mail inválido"),
  pin: z.string().regex(/^\d{6}$/, "PIN deve ter 6 dígitos"),
  status: z.enum(['ativo', 'inativo']),
  foto_rg_frente: z.string().optional(),
  foto_rg_verso: z.string().optional(),
  foto_facial: z.string().optional(),
});

// ============ MATERIAL ============
export type SubCategoriaMaterial = 
  | 'arma' 
  | 'carregador' 
  | 'municao' 
  | 'bastao' 
  | 'tonfa'
  | 'spargidor' 
  | 'celular' 
  | 'impressora' 
  | 'radio_ht'
  | 'algema' 
  | 'placa_balistica' 
  | 'capa_chuva'
  | 'colete_refletivo' 
  | 'diverso';

export type StatusMaterial = 'disponivel' | 'cautelado' | 'manutencao' | 'indisponivel' | 'baixado';

export interface Material {
  id: string;
  nome: string;
  patrimonio: string;
  numero_serie: string;
  codigo_interno: string;
  categoria_id: string;
  subcategoria: SubCategoriaMaterial;
  calibre: string | null;
  quantidade_total: number;
  quantidade_disponivel: number;
  status: StatusMaterial;
  observacoes: string;
  criado_em: Date;
  atualizado_em: Date;
}

export const materialSchema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  patrimonio: z.string().min(1, "Patrimônio obrigatório"),
  numero_serie: z.string().optional(),
  codigo_interno: z.string().min(1, "Código interno obrigatório"),
  categoria_id: z.string().uuid("Categoria inválida"),
  subcategoria: z.string(),
  calibre: z.string().optional(),
  quantidade_total: z.number().int().min(0),
  quantidade_disponivel: z.number().int().min(0),
  status: z.enum(['disponivel', 'cautelado', 'manutencao', 'indisponivel', 'baixado']),
  observacoes: z.string().optional(),
});

// ============ CATEGORIA ============
export interface Categoria {
  id: string;
  nome: string;
  tipo: 'arma' | 'municao' | 'equipamento' | 'diverso';
  requer_calibre: boolean;
}

// ============ CAUTELA ============
export type TipoCautela = 'diaria' | 'permanente';
export type StatusCautela = 'aberta' | 'parcial' | 'fechada' | 'divergente';
export type TipoAutenticacao = 'pin' | 'facial';

export interface Cautela {
  id: string;
  pessoa_id: string;
  tipo: TipoCautela;
  status: StatusCautela;
  data_abertura: Date;
  data_prevista_devolucao: Date | null;
  data_fechamento: Date | null;
  operador_id: string;
  autenticacao_tipo: TipoAutenticacao;
  observacoes: string;
  notificacao_enviada: boolean;
  criado_em: Date;
  atualizado_em: Date;
}

// ============ ITEM CAUTELA ============
export type StatusItemCautela = 'pendente' | 'devolvido' | 'danificado' | 'extraviado';

export interface OpcoesItemCautela {
  tipo_bastao?: 'bastao' | 'tonfa';
  algema_com_chave?: boolean;
  placa_com_capa?: boolean;
  descricao_diverso?: string;
}

export interface ItemCautela {
  id: string;
  cautela_id: string;
  material_id: string;
  quantidade: number;
  opcoes: OpcoesItemCautela;
  status: StatusItemCautela;
  data_cautelamento: Date;
  data_devolucao: Date | null;
  override_calibre: boolean;
  observacoes: string;
}

// ============ ESCALA DE SERVIÇO ============
export interface EscalaServico {
  id: string;
  pessoa_id: string;
  nome_identificado: string;
  rg_identificado: string;
  matricula_identificada: string;
  data_servico: Date;
  hora_inicio: string;
  hora_fim: string;
  fonte: 'whatsapp_grupo' | 'manual';
  documento_original: string;
  mensagem_whatsapp_id: string | null;
  criado_em: Date;
}

// ============ AUTORIZAÇÃO MANUAL ============
export interface AutorizacaoManual {
  id: string;
  pessoa_id: string;
  cautela_id: string;
  motivo: string;
  anexo_base64: string | null;
  operador_id: string;
  criado_em: Date;
}

// ============ CONFIGURAÇÃO DO SISTEMA ============
export interface ConfiguracaoSistema {
  id: string;
  whatsapp_numero: string;
  whatsapp_webhook_url: string;
  whatsapp_api_token: string;
  whatsapp_grupo_id: string;
  email_api_url: string;
  email_api_token: string;
  email_remetente: string;
  nome_orgao: string;
  atualizado_em: Date;
}

// ============ MENSAGEM WHATSAPP ============
export interface MensagemWhatsApp {
  id: string;
  whatsapp_message_id: string;
  tipo: 'texto' | 'documento' | 'imagem';
  conteudo: string;
  remetente: string;
  grupo_id: string;
  timestamp: Date;
  processada: boolean;
  escala_extraida: boolean;
  criado_em: Date;
}

// ============ AUDITORIA ============
export interface Auditoria {
  id: string;
  entidade: string;
  entidade_id: string;
  acao: string;
  operador_id: string;
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
  criado_em: Date;
}

// ============ TIPOS COMPLETOS PARA COMPONENTES ============
export interface PessoaComFoto extends Pessoa {
  foto_rg_pendente: boolean;
}

export interface CautelaCompleta extends Cautela {
  pessoa: Pessoa;
  items: (ItemCautela & { material: Material })[];
  operador: { nome: string; email: string };
}

export interface MaterialComCategoria extends Material {
  categoria: Categoria;
}

export interface DadosNotificacaoCautela {
  cautela: Cautela;
  pessoa: Pessoa;
  itens: (ItemCautela & { material: Material })[];
  operador_nome: string;
}

// ============ DADOS INICIAIS (SEED) ============
export interface SeedData {
  categorias: Categoria[];
  configuracao_inicial: Partial<ConfiguracaoSistema>;
}

// ============ RETORNOS DE API ============
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface BuscaPessoaResult {
  pessoa: Pessoa;
  cautelas_abertas: number;
  foto_rg_pendente: boolean;
}

export interface VerificacaoEscalaResult {
  autorizada: boolean;
  escala?: EscalaServico;
  mensagem?: string;
}
