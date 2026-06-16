-- Restaura RLS operator-scoped em todas as tabelas operacionais.
-- teste_db dependia de "Allow authenticated users" (removida na etapa 3).

CREATE OR REPLACE FUNCTION public.is_active_operator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('operator', 'supervisor')
      AND COALESCE(p.is_active, true)
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_operator() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_operator() TO authenticated;

-- persons
DROP POLICY IF EXISTS "persons_operator_rw" ON public.persons;
CREATE POLICY "persons_operator_rw" ON public.persons
  FOR ALL TO authenticated
  USING (public.is_active_operator())
  WITH CHECK (public.is_active_operator());

-- categories (legado — tabela pode não existir após merge)
DO $$
BEGIN
  IF to_regclass('public.categories') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "categories_operator_rw" ON public.categories';
    EXECUTE $p$
      CREATE POLICY "categories_operator_rw" ON public.categories
        FOR ALL TO authenticated
        USING (public.is_active_operator())
        WITH CHECK (public.is_active_operator())
    $p$;
    EXECUTE 'ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- materials
DROP POLICY IF EXISTS "materials_operator_rw" ON public.materials;
CREATE POLICY "materials_operator_rw" ON public.materials
  FOR ALL TO authenticated
  USING (public.is_active_operator())
  WITH CHECK (public.is_active_operator());

-- cautelas
DROP POLICY IF EXISTS "cautelas_operator_rw" ON public.cautelas;
CREATE POLICY "cautelas_operator_rw" ON public.cautelas
  FOR ALL TO authenticated
  USING (public.is_active_operator())
  WITH CHECK (public.is_active_operator());

-- cautela_items
DROP POLICY IF EXISTS "cautela_items_operator_rw" ON public.cautela_items;
CREATE POLICY "cautela_items_operator_rw" ON public.cautela_items
  FOR ALL TO authenticated
  USING (public.is_active_operator())
  WITH CHECK (public.is_active_operator());

-- divergences
DROP POLICY IF EXISTS "divergences_operator_rw" ON public.divergences;
CREATE POLICY "divergences_operator_rw" ON public.divergences
  FOR ALL TO authenticated
  USING (public.is_active_operator())
  WITH CHECK (public.is_active_operator());

-- audit_logs (append-only: SELECT + INSERT)
DROP POLICY IF EXISTS "audit_logs_operator_select" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_operator_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_operator_select" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_active_operator());
CREATE POLICY "audit_logs_operator_insert" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_operator());

-- corrections (append-only: SELECT + INSERT)
DROP POLICY IF EXISTS "corrections_operator_rw" ON public.corrections;
DROP POLICY IF EXISTS "corrections_operator_select" ON public.corrections;
DROP POLICY IF EXISTS "corrections_operator_insert" ON public.corrections;
CREATE POLICY "corrections_operator_select" ON public.corrections
  FOR SELECT TO authenticated
  USING (public.is_active_operator());
CREATE POLICY "corrections_operator_insert" ON public.corrections
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_operator());

-- Garantir RLS habilitado
ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cautelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cautela_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.divergences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corrections ENABLE ROW LEVEL SECURITY;
