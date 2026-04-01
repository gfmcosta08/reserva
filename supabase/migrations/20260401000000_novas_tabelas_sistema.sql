-- ========================================
-- MIGRATION: Novas tabelas (SEGURA - não modifica tabelas existentes)
-- ========================================

-- 1. Tabela de Configurações do Sistema
CREATE TABLE IF NOT EXISTS public.configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_numero TEXT,
  whatsapp_webhook_url TEXT,
  whatsapp_api_token TEXT,
  whatsapp_grupo_id TEXT,
  email_api_url TEXT,
  email_api_token TEXT,
  email_remetente TEXT,
  nome_orgao TEXT DEFAULT 'Organização de Segurança',
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Tabela de Mensagens WhatsApp (criar antes de escala_servico)
CREATE TABLE IF NOT EXISTS public.mensagens_whatsapp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_message_id TEXT NOT NULL,
  tipo TEXT DEFAULT 'texto',
  conteudo TEXT NOT NULL,
  remetente TEXT NOT NULL,
  grupo_id TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  processada BOOLEAN DEFAULT false,
  escala_extraida BOOLEAN DEFAULT false,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Tabela de Escala de Serviço
CREATE TABLE IF NOT EXISTS public.escala_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id UUID REFERENCES public.persons(id) ON DELETE SET NULL,
  nome_identificado TEXT NOT NULL,
  rg_identificado TEXT,
  matricula_identificada TEXT,
  data_servico DATE NOT NULL,
  hora_inicio TEXT NOT NULL,
  hora_fim TEXT NOT NULL,
  fonte TEXT DEFAULT 'manual',
  documento_original TEXT,
  mensagem_whatsapp_id TEXT,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Tabela de Autorizações Manuais
CREATE TABLE IF NOT EXISTS public.autorizacoes_manuais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id UUID REFERENCES public.persons(id) ON DELETE CASCADE NOT NULL,
  cautela_id UUID REFERENCES public.cautelas(id) ON DELETE SET NULL,
  motivo TEXT NOT NULL,
  anexo_base64 TEXT,
  operador_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Adicionar colunas à tabela de cautelas (apenas se não existirem)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cautelas' AND column_name = 'autenticacao_tipo') THEN
    ALTER TABLE public.cautelas ADD COLUMN autenticacao_tipo TEXT DEFAULT 'pin';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cautelas' AND column_name = 'notificacao_enviada') THEN
    ALTER TABLE public.cautelas ADD COLUMN notificacao_enviada BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cautelas' AND column_name = 'expires_at') THEN
    ALTER TABLE public.cautelas ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE;
  END IF;
END$$;

-- 6. Adicionar colunas à tabela de cautela_items (apenas se não existirem)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cautela_items' AND column_name = 'quantity_delivered') THEN
    ALTER TABLE public.cautela_items ADD COLUMN quantity_delivered INT DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cautela_items' AND column_name = 'quantity_returned') THEN
    ALTER TABLE public.cautela_items ADD COLUMN quantity_returned INT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cautela_items' AND column_name = 'returned_at') THEN
    ALTER TABLE public.cautela_items ADD COLUMN returned_at TIMESTAMP WITH TIME ZONE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cautela_items' AND column_name = 'returned_by') THEN
    ALTER TABLE public.cautela_items ADD COLUMN returned_by UUID REFERENCES public.profiles(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cautela_items' AND column_name = 'renewed_at') THEN
    ALTER TABLE public.cautela_items ADD COLUMN renewed_at TIMESTAMP WITH TIME ZONE;
  END IF;
END$$;

-- 7. Adicionar colunas à tabela de persons (apenas se não existirem)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'persons' AND column_name = 'phone') THEN
    ALTER TABLE public.persons ADD COLUMN phone TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'persons' AND column_name = 'cpf') THEN
    ALTER TABLE public.persons ADD COLUMN cpf TEXT;
  END IF;
END$$;

-- 8. Adicionar colunas à tabela de materials (apenas se não existirem)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'materials' AND column_name = 'caliber') THEN
    ALTER TABLE public.materials ADD COLUMN caliber TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'materials' AND column_name = 'subcategoria') THEN
    ALTER TABLE public.materials ADD COLUMN subcategoria TEXT;
  END IF;
END$$;

-- 9. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_escala_servico_data ON public.escala_servico(data_servico);
CREATE INDEX IF NOT EXISTS idx_escala_servico_pessoa ON public.escala_servico(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_whatsapp_grupo ON public.mensagens_whatsapp(grupo_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_whatsapp_processada ON public.mensagens_whatsapp(processada);
CREATE INDEX IF NOT EXISTS idx_autorizacoes_pessoa ON public.autorizacoes_manuais(pessoa_id);

-- 10. Habilitar RLS nas novas tabelas
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autorizacoes_manuais ENABLE ROW LEVEL SECURITY;

-- 11. Políticas RLS (apenas authenticated)
DROP POLICY IF EXISTS "Allow authenticated access to configuracoes" ON public.configuracoes;
CREATE POLICY "Allow authenticated access to configuracoes" ON public.configuracoes
  FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated access to escala_servico" ON public.escala_servico;
CREATE POLICY "Allow authenticated access to escala_servico" ON public.escala_servico
  FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated access to mensagens_whatsapp" ON public.mensagens_whatsapp;
CREATE POLICY "Allow authenticated access to mensagens_whatsapp" ON public.mensagens_whatsapp
  FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated access to autorizacoes_manuais" ON public.autorizacoes_manuais;
CREATE POLICY "Allow authenticated access to autorizacoes_manuais" ON public.autorizacoes_manuais
  FOR ALL TO authenticated USING (true);

-- 12. Inserir configuração inicial (apenas se não existir)
INSERT INTO public.configuracoes (nome_orgao) 
SELECT 'Organização de Segurança'
WHERE NOT EXISTS (SELECT 1 FROM public.configuracoes LIMIT 1);
