-- Etapa 2 — Segurança mínima (SEC-03, SEC-04, suporte SEC-01)

-- SEC-04: flag explícita must_change_pin em persons
ALTER TABLE public.persons
  ADD COLUMN IF NOT EXISTS must_change_pin BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.persons.must_change_pin IS
  'Quando true, bloqueia abertura de cautela até troca de PIN no balcão.';

-- SEC-01: leitura do próprio perfil (middleware/login verificam is_active mesmo se inativo)
DROP POLICY IF EXISTS "profiles_self_read" ON public.profiles;
CREATE POLICY "profiles_self_read" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- SEC-03: ammo_batches alinhado a is_active_operator() (remove USING true)
DROP POLICY IF EXISTS "Authenticated users can read ammo_batches" ON public.ammo_batches;
DROP POLICY IF EXISTS "Authenticated users can insert ammo_batches" ON public.ammo_batches;
DROP POLICY IF EXISTS "Authenticated users can update ammo_batches" ON public.ammo_batches;
DROP POLICY IF EXISTS "Authenticated users can delete ammo_batches" ON public.ammo_batches;

CREATE POLICY "ammo_batches_operator_rw" ON public.ammo_batches
  FOR ALL TO authenticated
  USING (public.is_active_operator())
  WITH CHECK (public.is_active_operator());
