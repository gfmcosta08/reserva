-- 🔒 Substitui políticas RLS permissivas (USING true) por verificação de operador ativo.
-- Aplicar no Supabase após revisão. Requer linha em profiles para cada usuário com role operator|supervisor.

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

-- Remover políticas antigas (nome do schema inicial)
DROP POLICY IF EXISTS "Allow authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated users" ON public.persons;
DROP POLICY IF EXISTS "Allow authenticated users" ON public.categories;
DROP POLICY IF EXISTS "Allow authenticated users" ON public.materials;
DROP POLICY IF EXISTS "Allow authenticated users" ON public.cautelas;
DROP POLICY IF EXISTS "Allow authenticated users" ON public.cautela_items;
DROP POLICY IF EXISTS "Allow authenticated users" ON public.divergences;
DROP POLICY IF EXISTS "Allow authenticated users" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow authenticated users" ON public.corrections;

CREATE POLICY "profiles_operator_rw" ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_active_operator())
  WITH CHECK (public.is_active_operator());

CREATE POLICY "persons_operator_rw" ON public.persons
  FOR ALL TO authenticated
  USING (public.is_active_operator())
  WITH CHECK (public.is_active_operator());

CREATE POLICY "categories_operator_rw" ON public.categories
  FOR ALL TO authenticated
  USING (public.is_active_operator())
  WITH CHECK (public.is_active_operator());

CREATE POLICY "materials_operator_rw" ON public.materials
  FOR ALL TO authenticated
  USING (public.is_active_operator())
  WITH CHECK (public.is_active_operator());

CREATE POLICY "cautelas_operator_rw" ON public.cautelas
  FOR ALL TO authenticated
  USING (public.is_active_operator())
  WITH CHECK (public.is_active_operator());

CREATE POLICY "cautela_items_operator_rw" ON public.cautela_items
  FOR ALL TO authenticated
  USING (public.is_active_operator())
  WITH CHECK (public.is_active_operator());

CREATE POLICY "divergences_operator_rw" ON public.divergences
  FOR ALL TO authenticated
  USING (public.is_active_operator())
  WITH CHECK (public.is_active_operator());

CREATE POLICY "audit_logs_operator_select" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_active_operator());

CREATE POLICY "audit_logs_operator_insert" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_operator());

CREATE POLICY "corrections_operator_rw" ON public.corrections
  FOR ALL TO authenticated
  USING (public.is_active_operator())
  WITH CHECK (public.is_active_operator());

COMMENT ON FUNCTION public.is_active_operator() IS 'True se auth.uid() é operador/supervisor ativo em profiles.';
