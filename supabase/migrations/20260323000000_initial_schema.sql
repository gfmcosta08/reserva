-- SUPABASE SCHEMA - CONTROLE DE CAUTELA

-- 0. Limpar tabelas existentes (CUIDADO: Isso apaga os dados!)
DROP TABLE IF EXISTS public.corrections CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.divergences CASCADE;
DROP TABLE IF EXISTS public.cautela_items CASCADE;
DROP TABLE IF EXISTS public.cautelas CASCADE;
DROP TABLE IF EXISTS public.materials CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.persons CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 1. Habilitar UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tabela de Usuários (Sincronizada com auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT CHECK (role IN ('operator', 'supervisor')) NOT NULL DEFAULT 'operator',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Tabela de Pessoas (Cautelados)
CREATE TABLE public.persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  rg TEXT UNIQUE NOT NULL, -- Registro Geral (apenas números, sem barra)
  registration_number TEXT UNIQUE NOT NULL, -- Matrícula
  function TEXT,
  status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  pin_hash TEXT NOT NULL,
  rg_front_url TEXT NOT NULL, -- Foto frente do RG (imutável)
  rg_back_url TEXT NOT NULL,  -- Foto verso do RG (imutável)
  face_descriptor JSONB, -- Vetor numérico do reconhecimento facial
  failed_pin_attempts INT DEFAULT 0,
  pin_locked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Categorias de Materiais
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL
);

-- 5. Materiais
CREATE TABLE public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id),
  patrimony_number TEXT UNIQUE NOT NULL,
  serial_number TEXT UNIQUE,
  internal_code TEXT UNIQUE NOT NULL,
  status TEXT CHECK (status IN ('available', 'cautelado', 'maintenance', 'unavailable')) DEFAULT 'available',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. Cautelas
CREATE TABLE public.cautelas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID REFERENCES public.persons(id) NOT NULL,
  operator_id UUID REFERENCES public.profiles(id) NOT NULL,
  type TEXT CHECK (type IN ('daily', 'permanent')) NOT NULL,
  status TEXT CHECK (status IN ('open', 'partial', 'closed', 'divergent')) DEFAULT 'open',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE
);

-- 7. Itens da Cautela
CREATE TABLE public.cautela_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cautela_id UUID REFERENCES public.cautelas(id) ON DELETE CASCADE,
  material_id UUID REFERENCES public.materials(id),
  status TEXT CHECK (status IN ('pending', 'returned', 'missing', 'damaged')) DEFAULT 'pending',
  notes TEXT,
  UNIQUE(cautela_id, material_id)
);

-- 8. Divergências
CREATE TABLE public.divergences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cautela_item_id UUID REFERENCES public.cautela_items(id),
  description TEXT NOT NULL,
  status TEXT CHECK (status IN ('open', 'resolved')) DEFAULT 'open',
  resolved_by UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 9. Auditoria (Audit Logs)
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID NOT NULL,
  before_state JSONB,
  after_state JSONB,
  ip_address TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 10. Correções (Histórico Auditoria)
CREATE TABLE public.corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  entity TEXT NOT NULL,
  entity_id UUID NOT NULL,
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  justification TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS (Row Level Security) - Básicos
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cautelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cautela_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.divergences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corrections ENABLE ROW LEVEL SECURITY;

-- Exemplo de Política: Somente autenticados podem ver os dados (simplificado para teste)
CREATE POLICY "Allow authenticated users" ON public.profiles FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users" ON public.persons FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users" ON public.categories FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users" ON public.materials FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users" ON public.cautelas FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users" ON public.cautela_items FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users" ON public.divergences FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users" ON public.audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users" ON public.corrections FOR ALL TO authenticated USING (true);
