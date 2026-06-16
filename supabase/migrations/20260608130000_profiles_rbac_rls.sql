-- SEC-05: RBAC em profiles — operador não pode INSERT/UPDATE/DELETE (escalada role=supervisor).
-- Leitura ampla permanece para exibir operador em cautelas/relatórios.

CREATE OR REPLACE FUNCTION public.is_supervisor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'supervisor'
      AND COALESCE(p.is_active, true)
  );
$$;

REVOKE ALL ON FUNCTION public.is_supervisor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_supervisor() TO authenticated;

COMMENT ON FUNCTION public.is_supervisor() IS
  'True se auth.uid() é supervisor ativo. Usado em policies de escrita em profiles.';

-- Remove políticas permissivas que permitiam operador alterar qualquer profile/role
DROP POLICY IF EXISTS "profiles_operator_rw" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated users" ON public.profiles;

-- Leitura: operador/supervisor ativo vê todos os profiles (nome/e-mail em cautelas)
DROP POLICY IF EXISTS "profiles_operator_select" ON public.profiles;
CREATE POLICY "profiles_operator_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_active_operator());

-- Escrita: somente supervisor
DROP POLICY IF EXISTS "profiles_supervisor_insert" ON public.profiles;
CREATE POLICY "profiles_supervisor_insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_supervisor());

DROP POLICY IF EXISTS "profiles_supervisor_update" ON public.profiles;
CREATE POLICY "profiles_supervisor_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_supervisor())
  WITH CHECK (public.is_supervisor());

DROP POLICY IF EXISTS "profiles_supervisor_delete" ON public.profiles;
CREATE POLICY "profiles_supervisor_delete" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.is_supervisor());

-- profiles_self_read (SEC-01 / etapa2): mantida — inativo ainda lê o próprio profile no middleware
