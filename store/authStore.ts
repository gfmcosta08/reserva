// ========================================
// ARQUIVO: src/store/authStore.ts
// ========================================

import { create } from 'zustand';
import { createClient } from '@/lib/supabase-client';

interface User {
  id: string;
  email: string;
  role: 'admin' | 'supervisor' | 'operator';
}

interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  
  // Actions
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  initialized: false,

  initialize: async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      set({
        user: {
          id: user.id,
          email: user.email || '',
          role: (profile?.role as 'admin' | 'supervisor' | 'operator') || 'operator',
        },
        initialized: true,
      });
    } else {
      set({ initialized: true });
    }
  },

  signIn: async (email: string, password: string) => {
    set({ loading: true });
    const supabase = createClient();
    
    const { error, data: { user } } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      set({ loading: false });
      return { error: error.message };
    }

    if (user) {
      await get().refreshUser();
    }
    
    set({ loading: false });
    return {};
  },

  signOut: async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    set({ user: null });
  },

  refreshUser: async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      set({
        user: {
          id: user.id,
          email: user.email || '',
          role: (profile?.role as 'admin' | 'supervisor' | 'operator') || 'operator',
        },
      });
    }
  },
}));
