-- ========================================
-- FASE 2: Cutover final + reset completo do modulo
-- ========================================

-- 1) Reset completo do modulo de materiais/cautela
DELETE FROM public.divergences;
DELETE FROM public.cautela_items;
DELETE FROM public.cautelas;
DELETE FROM public.materials;

-- 2) Limpeza de auditoria relacionada ao modulo
DELETE FROM public.audit_logs
WHERE entity IN ('materials', 'cautelas', 'cautela_items', 'divergences');

DELETE FROM public.corrections
WHERE entity IN ('materials', 'cautelas', 'cautela_items', 'divergences');

-- 3) Remocao de colunas legadas
ALTER TABLE public.materials DROP COLUMN IF EXISTS category_id;
ALTER TABLE public.materials DROP COLUMN IF EXISTS category;

-- 4) Remocao da tabela categories e politicas RLS associadas
DO $$
BEGIN
  IF to_regclass('public.categories') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated users" ON public.categories';
    EXECUTE 'DROP POLICY IF EXISTS "categories_operator_rw" ON public.categories';
  END IF;
END $$;

DROP TABLE IF EXISTS public.categories;

