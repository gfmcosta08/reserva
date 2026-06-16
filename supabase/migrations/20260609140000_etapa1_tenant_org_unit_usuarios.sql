-- Etapa 1 — Tenancy: organizations + units + usuarios + escopo unit em tabelas operacionais.
-- Alinhado a docs/PLANO-PRODUTO-VERTICAL.md (M1). Somente estrutura + RLS; status/movimentações ficam para etapas posteriores.

-- ---------------------------------------------------------------------------
-- 1. Tabelas de tenancy
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

CREATE INDEX IF NOT EXISTS units_organization_id_idx ON public.units (organization_id);

CREATE TABLE IF NOT EXISTS public.usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN ('operator', 'supervisor', 'admin')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS usuarios_auth_user_id_idx ON public.usuarios (auth_user_id);
CREATE INDEX IF NOT EXISTS usuarios_unit_id_idx ON public.usuarios (unit_id);
CREATE INDEX IF NOT EXISTS usuarios_organization_id_idx ON public.usuarios (organization_id);

-- ---------------------------------------------------------------------------
-- 2. Seed org/unidade padrão (backfill 1º BPM)
-- ---------------------------------------------------------------------------

INSERT INTO public.organizations (id, name, slug)
VALUES ('00000000-0000-4000-8000-000000000001', '1º Batalhão de Polícia Militar', '1bpm')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.units (id, organization_id, name, code)
SELECT
  '00000000-0000-4000-8000-000000000101',
  o.id,
  '1º BPM — Unidade operacional',
  '1BPM'
FROM public.organizations o
WHERE o.slug = '1bpm'
ON CONFLICT (organization_id, code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Colunas organization_id + unit_id nas tabelas operacionais
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'persons', 'materials', 'cautelas', 'cautela_items',
    'divergences', 'audit_logs', 'corrections', 'ammo_batches'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id)',
        t
      );
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.units(id)',
        t
      );
    END IF;
  END LOOP;
END $$;

-- Backfill via org/unidade padrão
DO $$
DECLARE
  v_org_id uuid;
  v_unit_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM public.organizations WHERE slug = '1bpm' LIMIT 1;
  SELECT id INTO v_unit_id FROM public.units WHERE code = '1BPM' AND organization_id = v_org_id LIMIT 1;

  IF v_org_id IS NULL OR v_unit_id IS NULL THEN
    RAISE EXCEPTION 'Seed org/unit 1bpm ausente';
  END IF;

  UPDATE public.persons
  SET organization_id = v_org_id, unit_id = v_unit_id
  WHERE organization_id IS NULL OR unit_id IS NULL;

  UPDATE public.materials
  SET organization_id = v_org_id, unit_id = v_unit_id
  WHERE organization_id IS NULL OR unit_id IS NULL;

  UPDATE public.cautelas c
  SET organization_id = v_org_id, unit_id = v_unit_id
  WHERE c.organization_id IS NULL OR c.unit_id IS NULL;

  UPDATE public.cautela_items ci
  SET organization_id = v_org_id, unit_id = v_unit_id
  FROM public.cautelas c
  WHERE ci.cautela_id = c.id
    AND (ci.organization_id IS NULL OR ci.unit_id IS NULL);

  UPDATE public.divergences d
  SET organization_id = v_org_id, unit_id = v_unit_id
  WHERE d.organization_id IS NULL OR d.unit_id IS NULL;

  UPDATE public.audit_logs
  SET organization_id = v_org_id, unit_id = v_unit_id
  WHERE organization_id IS NULL OR unit_id IS NULL;

  UPDATE public.corrections
  SET organization_id = v_org_id, unit_id = v_unit_id
  WHERE organization_id IS NULL OR unit_id IS NULL;

  IF to_regclass('public.ammo_batches') IS NOT NULL THEN
    UPDATE public.ammo_batches
    SET organization_id = v_org_id, unit_id = v_unit_id
    WHERE organization_id IS NULL OR unit_id IS NULL;
  END IF;
END $$;

-- NOT NULL após backfill
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'persons', 'materials', 'cautelas', 'cautela_items',
    'divergences', 'audit_logs', 'corrections', 'ammo_batches'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN organization_id SET NOT NULL', t);
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN unit_id SET NOT NULL', t);
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I (unit_id)',
        t || '_unit_id_idx', t
      );
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. usuarios a partir de profiles existentes
-- ---------------------------------------------------------------------------

INSERT INTO public.usuarios (auth_user_id, organization_id, unit_id, role, is_active)
SELECT
  p.id,
  o.id,
  u.id,
  CASE WHEN p.role = 'supervisor' THEN 'supervisor' ELSE 'operator' END,
  COALESCE(p.is_active, true)
FROM public.profiles p
CROSS JOIN public.organizations o
CROSS JOIN public.units u
WHERE o.slug = '1bpm'
  AND u.code = '1BPM'
  AND u.organization_id = o.id
  AND p.role IN ('operator', 'supervisor')
ON CONFLICT (auth_user_id) DO UPDATE
SET
  organization_id = EXCLUDED.organization_id,
  unit_id = EXCLUDED.unit_id,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 5. Funções de contexto (RLS)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_usuario_row()
RETURNS public.usuarios
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.*
  FROM public.usuarios u
  WHERE u.auth_user_id = auth.uid()
    AND u.is_active
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_usuario_row() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_usuario_row() TO authenticated;

CREATE OR REPLACE FUNCTION public.current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (public.current_usuario_row()).organization_id;
$$;

REVOKE ALL ON FUNCTION public.current_organization_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_organization_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.current_unit_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (public.current_usuario_row()).unit_id;
$$;

REVOKE ALL ON FUNCTION public.current_unit_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_unit_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.user_can_access_unit(p_unit_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    JOIN public.units un ON un.id = p_unit_id
    WHERE u.auth_user_id = auth.uid()
      AND u.is_active
      AND (
        u.unit_id = p_unit_id
        OR (
          u.role IN ('supervisor', 'admin')
          AND u.organization_id = un.organization_id
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.user_can_access_unit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_access_unit(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_active_operator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.auth_user_id = auth.uid()
      AND u.is_active
      AND u.role IN ('operator', 'supervisor', 'admin')
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_operator() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_operator() TO authenticated;

COMMENT ON FUNCTION public.is_active_operator() IS
  'Operador ativo com vínculo em usuarios (org/unit). Etapa 1 tenancy.';

-- ---------------------------------------------------------------------------
-- 6. RLS tenancy nas tabelas operacionais
-- ---------------------------------------------------------------------------

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organizations_member_select" ON public.organizations;
CREATE POLICY "organizations_member_select" ON public.organizations
  FOR SELECT TO authenticated
  USING (
    public.is_active_operator()
    AND id = public.current_organization_id()
  );

DROP POLICY IF EXISTS "units_member_select" ON public.units;
CREATE POLICY "units_member_select" ON public.units
  FOR SELECT TO authenticated
  USING (
    public.is_active_operator()
    AND organization_id = public.current_organization_id()
  );

DROP POLICY IF EXISTS "usuarios_self_select" ON public.usuarios;
CREATE POLICY "usuarios_self_select" ON public.usuarios
  FOR SELECT TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR (
      public.is_active_operator()
      AND organization_id = public.current_organization_id()
      AND (public.current_usuario_row()).role IN ('supervisor', 'admin')
    )
  );

DROP POLICY IF EXISTS "persons_operator_rw" ON public.persons;
CREATE POLICY "persons_unit_scoped_rw" ON public.persons
  FOR ALL TO authenticated
  USING (public.is_active_operator() AND public.user_can_access_unit(unit_id))
  WITH CHECK (public.is_active_operator() AND public.user_can_access_unit(unit_id));

DROP POLICY IF EXISTS "materials_operator_rw" ON public.materials;
CREATE POLICY "materials_unit_scoped_rw" ON public.materials
  FOR ALL TO authenticated
  USING (public.is_active_operator() AND public.user_can_access_unit(unit_id))
  WITH CHECK (public.is_active_operator() AND public.user_can_access_unit(unit_id));

DROP POLICY IF EXISTS "cautelas_operator_rw" ON public.cautelas;
CREATE POLICY "cautelas_unit_scoped_rw" ON public.cautelas
  FOR ALL TO authenticated
  USING (public.is_active_operator() AND public.user_can_access_unit(unit_id))
  WITH CHECK (public.is_active_operator() AND public.user_can_access_unit(unit_id));

DROP POLICY IF EXISTS "cautela_items_operator_rw" ON public.cautela_items;
CREATE POLICY "cautela_items_unit_scoped_rw" ON public.cautela_items
  FOR ALL TO authenticated
  USING (public.is_active_operator() AND public.user_can_access_unit(unit_id))
  WITH CHECK (public.is_active_operator() AND public.user_can_access_unit(unit_id));

DROP POLICY IF EXISTS "divergences_operator_rw" ON public.divergences;
CREATE POLICY "divergences_unit_scoped_rw" ON public.divergences
  FOR ALL TO authenticated
  USING (public.is_active_operator() AND public.user_can_access_unit(unit_id))
  WITH CHECK (public.is_active_operator() AND public.user_can_access_unit(unit_id));

DROP POLICY IF EXISTS "audit_logs_operator_select" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_operator_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_unit_scoped_select" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_active_operator() AND public.user_can_access_unit(unit_id));
CREATE POLICY "audit_logs_unit_scoped_insert" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_operator() AND public.user_can_access_unit(unit_id));

DROP POLICY IF EXISTS "corrections_operator_select" ON public.corrections;
DROP POLICY IF EXISTS "corrections_operator_insert" ON public.corrections;
CREATE POLICY "corrections_unit_scoped_select" ON public.corrections
  FOR SELECT TO authenticated
  USING (public.is_active_operator() AND public.user_can_access_unit(unit_id));
CREATE POLICY "corrections_unit_scoped_insert" ON public.corrections
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_operator() AND public.user_can_access_unit(unit_id));

DROP POLICY IF EXISTS "Authenticated users can read ammo_batches" ON public.ammo_batches;
DROP POLICY IF EXISTS "Authenticated users can insert ammo_batches" ON public.ammo_batches;
DROP POLICY IF EXISTS "Authenticated users can update ammo_batches" ON public.ammo_batches;

CREATE POLICY "ammo_batches_unit_scoped_select" ON public.ammo_batches
  FOR SELECT TO authenticated
  USING (public.is_active_operator() AND public.user_can_access_unit(unit_id));

CREATE POLICY "ammo_batches_unit_scoped_insert" ON public.ammo_batches
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_operator() AND public.user_can_access_unit(unit_id));

CREATE POLICY "ammo_batches_unit_scoped_update" ON public.ammo_batches
  FOR UPDATE TO authenticated
  USING (public.is_active_operator() AND public.user_can_access_unit(unit_id))
  WITH CHECK (public.is_active_operator() AND public.user_can_access_unit(unit_id));

-- ---------------------------------------------------------------------------
-- 7. create_cautela_atomic — grava org/unit e valida escopo
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_cautela_atomic(
  p_person_id uuid,
  p_type text,
  p_notes text,
  p_items jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_operator_id uuid := auth.uid();
  v_cautela_id uuid;
  v_item_ids uuid[] := ARRAY[]::uuid[];
  v_id uuid;
  r record;
  v_distinct_ids uuid[];
  v_stock int;
  v_status text;
  v_org_id uuid;
  v_unit_id uuid;
  v_person_unit uuid;
BEGIN
  IF v_operator_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT organization_id, unit_id
  INTO v_org_id, v_unit_id
  FROM public.usuarios
  WHERE auth_user_id = v_operator_id AND is_active
  LIMIT 1;

  IF v_org_id IS NULL OR v_unit_id IS NULL THEN
    RAISE EXCEPTION 'OPERATOR_NO_UNIT';
  END IF;

  SELECT unit_id INTO v_person_unit FROM public.persons WHERE id = p_person_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PERSON_NOT_FOUND';
  END IF;
  IF v_person_unit IS DISTINCT FROM v_unit_id
     AND NOT EXISTS (
       SELECT 1 FROM public.usuarios u
       WHERE u.auth_user_id = v_operator_id
         AND u.is_active
         AND u.role IN ('supervisor', 'admin')
         AND u.organization_id = v_org_id
     ) THEN
    RAISE EXCEPTION 'PERSON_UNIT_MISMATCH';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'EMPTY_MATERIALS';
  END IF;

  DROP TABLE IF EXISTS _cautela_merge;
  CREATE TEMP TABLE _cautela_merge (
    material_id uuid PRIMARY KEY,
    quantity int NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO _cautela_merge (material_id, quantity)
  SELECT
    (je.value->>'material_id')::uuid,
    SUM(GREATEST(COALESCE((je.value->>'quantity')::int, 1), 1))::int
  FROM jsonb_array_elements(p_items) AS je
  GROUP BY (je.value->>'material_id')::uuid;

  SELECT ARRAY_AGG(material_id ORDER BY material_id) INTO v_distinct_ids FROM _cautela_merge;

  IF v_distinct_ids IS NULL OR cardinality(v_distinct_ids) = 0 THEN
    RAISE EXCEPTION 'EMPTY_MATERIALS';
  END IF;

  FOR r IN SELECT material_id, quantity FROM _cautela_merge ORDER BY material_id
  LOOP
    SELECT stock_quantity, status
    INTO v_stock, v_status
    FROM public.materials
    WHERE id = r.material_id
      AND unit_id = v_unit_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'MATERIAL_NOT_FOUND';
    END IF;

    IF v_status <> 'available' THEN
      RAISE EXCEPTION 'MATERIALS_NOT_ALL_AVAILABLE';
    END IF;

    IF v_stock < r.quantity THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK';
    END IF;
  END LOOP;

  INSERT INTO public.cautelas (person_id, operator_id, type, status, notes, organization_id, unit_id)
  VALUES (p_person_id, v_operator_id, p_type, 'open', p_notes, v_org_id, v_unit_id)
  RETURNING id INTO v_cautela_id;

  FOR r IN SELECT material_id, quantity FROM _cautela_merge ORDER BY material_id
  LOOP
    INSERT INTO public.cautela_items (
      cautela_id, material_id, status, quantity_delivered, organization_id, unit_id
    )
    VALUES (v_cautela_id, r.material_id, 'pending', r.quantity, v_org_id, v_unit_id)
    RETURNING id INTO v_id;
    v_item_ids := array_append(v_item_ids, v_id);
  END LOOP;

  FOR r IN SELECT material_id, quantity FROM _cautela_merge ORDER BY material_id
  LOOP
    UPDATE public.materials
    SET
      stock_quantity = stock_quantity - r.quantity,
      status = CASE
        WHEN stock_quantity - r.quantity <= 0 THEN 'cautelado'
        ELSE 'available'
      END,
      updated_at = now()
    WHERE id = r.material_id;
  END LOOP;

  RETURN jsonb_build_object(
    'cautela_id', v_cautela_id,
    'cautela_item_ids', to_jsonb(v_item_ids)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_cautela_atomic(uuid, text, text, jsonb) TO authenticated;

INSERT INTO public.audit_logs (action, entity, entity_id, after_state, organization_id, unit_id)
SELECT
  'etapa1_tenant_bootstrap',
  'organizations',
  o.id,
  jsonb_build_object(
    'organizations', 1,
    'units', (SELECT count(*) FROM public.units un WHERE un.organization_id = o.id),
    'usuarios', (SELECT count(*) FROM public.usuarios u WHERE u.organization_id = o.id)
  ),
  o.id,
  u.id
FROM public.organizations o
JOIN public.units u ON u.organization_id = o.id AND u.code = '1BPM'
WHERE o.slug = '1bpm';
