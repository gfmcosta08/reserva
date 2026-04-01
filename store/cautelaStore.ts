// ========================================
// ARQUIVO: src/store/cautelaStore.ts
// ========================================

import { create } from 'zustand';
import { 
  Cautela, 
  ItemCautela, 
  Material,
  TipoCautela,
  StatusCautela 
} from '@/types';

interface SupabasePessoa {
  id: string;
  full_name: string;
  rg: string;
  registration_number: string;
  function: string;
  status: string;
  rg_front_url: string | null;
  rg_back_url: string | null;
  face_descriptor: number[] | null;
  has_registered_pin?: boolean;
}

interface CautelaItemData {
  material_id: string;
  quantidade: number;
  opcoes?: {
    tipo_bastao?: 'bastao' | 'tonfa';
    algema_com_chave?: boolean;
    placa_com_capa?: boolean;
    descricao_diverso?: string;
  };
}

interface CautelaState {
  // Wizard state
  step: number;
  selectedPessoa: SupabasePessoa | null;
  items: CautelaItemData[];
  tipo: TipoCautela;
  dataPrevistaDevolucao: Date | null;
  observacoes: string;
  autenticacaoTipo: 'pin' | 'facial';
  
  // Lists
  cautelas: Cautela[];
  cautelaAtual: (Cautela & { pessoa: SupabasePessoa; items: (ItemCautela & { material: Material })[] }) | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  setStep: (step: number) => void;
  setSelectedPessoa: (pessoa: SupabasePessoa | null) => void;
  addItem: (item: CautelaItemData) => void;
  updateItem: (index: number, item: CautelaItemData) => void;
  removeItem: (index: number) => void;
  setTipo: (tipo: TipoCautela) => void;
  setDataPrevistaDevolucao: (date: Date | null) => void;
  setObservacoes: (obs: string) => void;
  setAutenticacaoTipo: (tipo: 'pin' | 'facial') => void;
  resetWizard: () => void;
  
  // Async actions
  fetchCautelas: (filters?: { status?: StatusCautela; search?: string }) => Promise<void>;
  fetchCautelaById: (id: string) => Promise<void>;
  createCautela: (pin?: string) => Promise<{ success: boolean; error?: string; cautelaId?: string }>;
}

export const useCautelaStore = create<CautelaState>((set, get) => ({
  step: 1,
  selectedPessoa: null,
  items: [],
  tipo: 'diaria',
  dataPrevistaDevolucao: null,
  observacoes: '',
  autenticacaoTipo: 'pin',
  cautelas: [],
  cautelaAtual: null,
  loading: false,
  error: null,

  setStep: (step) => set({ step }),
  
  setSelectedPessoa: (pessoa) => set({ selectedPessoa: pessoa }),
  
  addItem: (item) => set((state) => ({ 
    items: [...state.items, item] 
  })),
  
  updateItem: (index, item) => set((state) => {
    const newItems = [...state.items];
    newItems[index] = item;
    return { items: newItems };
  }),
  
  removeItem: (index) => set((state) => ({
    items: state.items.filter((_, i) => i !== index)
  })),
  
  setTipo: (tipo) => set({ tipo }),
  setDataPrevistaDevolucao: (date) => set({ dataPrevistaDevolucao: date }),
  setObservacoes: (obs) => set({ observacoes: obs }),
  setAutenticacaoTipo: (tipo) => set({ autenticacaoTipo: tipo }),
  
  resetWizard: () => set({
    step: 1,
    selectedPessoa: null,
    items: [],
    tipo: 'diaria',
    dataPrevistaDevolucao: null,
    observacoes: '',
    autenticacaoTipo: 'pin',
    error: null,
  }),
  
  fetchCautelas: async (filters) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.search) params.append('search', filters.search);
      
      const response = await fetch(`/api/cautelas?${params.toString()}`);
      const data = await response.json();
      
      if (data.error) {
        set({ error: data.error });
      } else {
        set({ cautelas: data.cautelas || [] });
      }
    } catch (err) {
      set({ error: 'Erro ao buscar cautelas' });
    } finally {
      set({ loading: false });
    }
  },
  
  fetchCautelaById: async (id) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`/api/cautelas/${id}`);
      const data = await response.json();
      
      if (data.error) {
        set({ error: data.error });
      } else {
        set({ cautelaAtual: data.cautela });
      }
    } catch (err) {
      set({ error: 'Erro ao buscar cautela' });
    } finally {
      set({ loading: false });
    }
  },
  
  createCautela: async (pin) => {
    const state = get();
    if (!state.selectedPessoa) {
      return { success: false, error: 'Selecione uma pessoa' };
    }
    if (state.items.length === 0) {
      return { success: false, error: 'Adicione pelo menos um material' };
    }
    
    set({ loading: true, error: null });
    try {
      const response = await fetch('/api/cautelas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_id: state.selectedPessoa.id,
          type: state.tipo,
          items: state.items,
          notes: state.observacoes,
          expected_return_date: state.dataPrevistaDevolucao?.toISOString(),
          pin,
          autenticacao_tipo: state.autenticacaoTipo,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        return { success: true, cautelaId: data.cautelaId };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      return { success: false, error: 'Erro ao criar cautela' };
    } finally {
      set({ loading: false });
    }
  },
}));
