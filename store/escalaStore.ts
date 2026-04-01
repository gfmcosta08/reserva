// ========================================
// ARQUIVO: src/store/escalaStore.ts
// ========================================

import { create } from 'zustand';
import { EscalaServico, MensagemWhatsApp, AutorizacaoManual } from '@/types';

interface EscalaState {
  // Escala do dia
  escalasHoje: EscalaServico[];
  autorizacoesManuais: AutorizacaoManual[];
  
  // WhatsApp
  mensagens: MensagemWhatsApp[];
  grupos: { id: string; nome: string }[];
  grupoSelecionadoId: string | null;
  whatsappConectado: boolean;
  
  // Loading states
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchEscalasHoje: () => Promise<void>;
  fetchAutorizacoesManuais: (pessoaId: string) => Promise<void>;
  verificarAutorizacao: (pessoaId: string) => Promise<{
    autorizada: boolean;
    escala?: EscalaServico;
    mensagem?: string;
  }>;
  registrarAutorizacaoManual: (data: {
    pessoa_id: string;
    cautela_id?: string;
    motivo: string;
    anexo_base64?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  
  // WhatsApp actions
  fetchMensagens: (grupoId?: string) => Promise<void>;
  processarMensagem: (mensagemId: string) => Promise<void>;
  conectarWhatsApp: () => Promise<void>;
  setGrupoSelecionado: (grupoId: string) => void;
}

export const useEscalaStore = create<EscalaState>((set, get) => ({
  escalasHoje: [],
  autorizacoesManuais: [],
  mensagens: [],
  grupos: [],
  grupoSelecionadoId: null,
  whatsappConectado: false,
  loading: false,
  error: null,

  fetchEscalasHoje: async () => {
    set({ loading: true, error: null });
    try {
      const hoje = new Date().toISOString().split('T')[0];
      const response = await fetch(`/api/escala?data=${hoje}`);
      const data = await response.json();
      
      if (data.escalas) {
        set({ escalasHoje: data.escalas });
      }
    } catch (err) {
      set({ error: 'Erro ao buscar escalas' });
    } finally {
      set({ loading: false });
    }
  },

  fetchAutorizacoesManuais: async (pessoaId: string) => {
    try {
      const response = await fetch(`/api/autorizacoes-manuais?pessoa_id=${pessoaId}`);
      const data = await response.json();
      
      if (data.autorizacoes) {
        set({ autorizacoesManuais: data.autorizacoes });
      }
    } catch (err) {
      console.error('Erro ao buscar autorizações:', err);
    }
  },

  verificarAutorizacao: async (pessoaId: string) => {
    const { escalasHoje } = get();
    const hoje = new Date().toISOString().split('T')[0];
    
    const escala = escalasHoje.find(e => 
      e.data_servico.toString().split('T')[0] === hoje && 
      (e.pessoa_id === pessoaId || e.matricula_identificada)
    );
    
    if (escala) {
      return {
        autorizada: true,
        escala,
        mensagem: `Autorizada para cautelar — Serviço: ${escala.data_servico} das ${escala.hora_inicio} às ${escala.hora_fim}`,
      };
    }
    
    // Verificar autorização manual
    const autorizacoes = get().autorizacoesManuais;
    const authManual = autorizacoes.find(a => a.pessoa_id === pessoaId);
    
    if (authManual) {
      return {
        autorizada: true,
        mensagem: 'Autorização manual registrada',
      };
    }
    
    return {
      autorizada: false,
      mensagem: 'Pessoa não autorizada a cautelar material. Ela não consta na escala de serviço de hoje. Entre em contato com o comandante para obter autorização.',
    };
  },

  registrarAutorizacaoManual: async (data) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch('/api/autorizacoes-manuais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      const result = await response.json();
      
      if (result.success) {
        await get().fetchAutorizacoesManuais(data.pessoa_id);
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (err) {
      return { success: false, error: 'Erro ao registrar autorização' };
    } finally {
      set({ loading: false });
    }
  },

  fetchMensagens: async (grupoId?: string) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (grupoId) params.append('grupo_id', grupoId);
      
      const response = await fetch(`/api/whatsapp/mensagens?${params.toString()}`);
      const data = await response.json();
      
      if (data.mensagens) {
        set({ mensagens: data.mensagens });
      }
      if (data.grupos) {
        set({ grupos: data.grupos });
      }
    } catch (err) {
      set({ error: 'Erro ao buscar mensagens' });
    } finally {
      set({ loading: false });
    }
  },

  processarMensagem: async (mensagemId: string) => {
    try {
      const response = await fetch(`/api/whatsapp/processar/${mensagemId}`, {
        method: 'POST',
      });
      
      const result = await response.json();
      
      if (result.success) {
        await get().fetchMensagens(get().grupoSelecionadoId || undefined);
        await get().fetchEscalasHoje();
      }
    } catch (err) {
      console.error('Erro ao processar mensagem:', err);
    }
  },

  conectarWhatsApp: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch('/api/whatsapp/conectar', {
        method: 'POST',
      });
      
      const result = await response.json();
      
      if (result.success) {
        set({ whatsappConectado: true });
      } else {
        set({ error: result.error || 'Erro ao conectar WhatsApp' });
      }
    } catch (err) {
      set({ error: 'Erro ao conectar WhatsApp' });
    } finally {
      set({ loading: false });
    }
  },

  setGrupoSelecionado: (grupoId: string) => {
    set({ grupoSelecionadoId: grupoId });
    get().fetchMensagens(grupoId);
  },
}));
