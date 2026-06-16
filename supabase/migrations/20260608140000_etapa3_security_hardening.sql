-- Etapa 3 — Hardening: remove policies legadas permissivas + audit/corrections append-only

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname = 'Allow authenticated users'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname,
      r.schemaname,
      r.tablename
    );
  END LOOP;
END $$;

-- ammo_batches: garantir operator-only (caso policies USING(true) tenham voltado)
DROP POLICY IF EXISTS "Authenticated users can read ammo_batches" ON public.ammo_batches;
DROP POLICY IF EXISTS "Authenticated users can insert ammo_batches" ON public.ammo_batches;
DROP POLICY IF EXISTS "Authenticated users can update ammo_batches" ON public.ammo_batches;
DROP POLICY IF EXISTS "Authenticated users can delete ammo_batches" ON public.ammo_batches;

DROP POLICY IF EXISTS "ammo_batches_operator_rw" ON public.ammo_batches;
CREATE POLICY "ammo_batches_operator_rw" ON public.ammo_batches
  FOR ALL TO authenticated
  USING (public.is_active_operator())
  WITH CHECK (public.is_active_operator());

-- audit_logs: somente INSERT + SELECT (append-only)
REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated;
REVOKE UPDATE, DELETE ON public.audit_logs FROM anon;

-- corrections: trilha de auditoria imutável
REVOKE UPDATE, DELETE ON public.corrections FROM authenticated;
REVOKE UPDATE, DELETE ON public.corrections FROM anon;

COMMENT ON TABLE public.audit_logs IS 'Trilha append-only — UPDATE/DELETE revogados para authenticated/anon.';
