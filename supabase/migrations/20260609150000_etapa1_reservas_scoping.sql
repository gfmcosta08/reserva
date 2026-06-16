-- Etapa 1 (complemento): reservas físicas por unidade (batalhão) + escopo reserva_id.
-- Evolui organizations/units — NÃO cria batalhoes em paralelo.

CREATE TABLE IF NOT EXISTS public.reservas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  responsavel TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unit_id, code)
);

CREATE INDEX IF NOT EXISTS reservas_unit_id_idx ON public.reservas (unit_id);
CREATE INDEX IF NOT EXISTS reservas_organization_id_idx ON public.reservas (organization_id);

-- Reserva principal 1BPM + reserva QA (isolamento)
INSERT INTO public.reservas (id, organization_id, unit_id, name, code, responsavel, ativo)
SELECT
  '00000000-0000-4000-8000-000000000201',
  u.organization_id,
  u.id,
  'Reserva Principal 1º BPM',
  'RES-1BPM',
  'Armeiro',
  true
FROM public.units u
WHERE u.code = '1BPM'
ON CONFLICT (unit_id, code) DO NOTHING;

INSERT INTO public.reservas (id, organization_id, unit_id, name, code, responsavel, ativo)
SELECT
  '00000000-0000-4000-8000-000000000202',
  u.organization_id,
  u.id,
  'Reserva QA Isolamento',
  'RES-QAISO',
  'QA',
  true
FROM public.units u
WHERE u.code = 'QAISO'
ON CONFLICT (unit_id, code) DO NOTHING;

-- reserva_id em usuarios e tabelas operacionais
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS reserva_id UUID REFERENCES public.reservas(id);

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
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS reserva_id UUID REFERENCES public.reservas(id)',
        t
      );
    END IF;
  END LOOP;
END $$;

-- Backfill: reserva padrão por unidade
UPDATE public.materials m
SET reserva_id = res.id
FROM public.units u, public.reservas res
WHERE m.reserva_id IS NULL
  AND u.id = m.unit_id
  AND res.unit_id = u.id
  AND (
    (u.code = '1BPM' AND res.code = 'RES-1BPM')
    OR (u.code = 'QAISO' AND res.code = 'RES-QAISO')
    OR res.code = 'RES-' || u.code
  );

UPDATE public.persons p
SET reserva_id = res.id
FROM public.reservas res
WHERE p.reserva_id IS NULL
  AND res.unit_id = p.unit_id
  AND res.code = CASE
    WHEN EXISTS (SELECT 1 FROM public.units u WHERE u.id = p.unit_id AND u.code = '1BPM') THEN 'RES-1BPM'
    WHEN EXISTS (SELECT 1 FROM public.units u WHERE u.id = p.unit_id AND u.code = 'QAISO') THEN 'RES-QAISO'
    ELSE 'RES-1BPM'
  END;

UPDATE public.cautelas c
SET reserva_id = res.id
FROM public.reservas res
WHERE c.reserva_id IS NULL
  AND res.unit_id = c.unit_id
  AND res.code = CASE
    WHEN EXISTS (SELECT 1 FROM public.units u WHERE u.id = c.unit_id AND u.code = '1BPM') THEN 'RES-1BPM'
    ELSE 'RES-QAISO'
  END;

UPDATE public.cautela_items ci
SET reserva_id = c.reserva_id
FROM public.cautelas c
WHERE ci.cautela_id = c.id AND ci.reserva_id IS NULL;

UPDATE public.divergences d SET reserva_id = res.id
FROM public.reservas res
WHERE d.reserva_id IS NULL AND res.code = 'RES-1BPM';

UPDATE public.audit_logs a SET reserva_id = res.id
FROM public.reservas res
WHERE a.reserva_id IS NULL AND res.code = 'RES-1BPM';

UPDATE public.corrections c SET reserva_id = res.id
FROM public.reservas res
WHERE c.reserva_id IS NULL AND res.code = 'RES-1BPM';

UPDATE public.ammo_batches ab
SET reserva_id = res.id
FROM public.reservas res
WHERE ab.reserva_id IS NULL
  AND res.unit_id = ab.unit_id
  AND res.code = 'RES-1BPM';

UPDATE public.usuarios u
SET reserva_id = res.id
FROM public.reservas res
WHERE u.reserva_id IS NULL
  AND res.unit_id = u.unit_id
  AND res.code = 'RES-1BPM';

-- NOT NULL
ALTER TABLE public.usuarios ALTER COLUMN reserva_id SET NOT NULL;

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
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN reserva_id SET NOT NULL', t);
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I (reserva_id)',
        t || '_reserva_id_idx', t
      );
    END IF;
  END LOOP;
END $$;

-- Funções de escopo por reserva
CREATE OR REPLACE FUNCTION public.current_reserva_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (public.current_usuario_row()).reserva_id;
$$;

REVOKE ALL ON FUNCTION public.current_reserva_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_reserva_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.user_can_access_reserva(
  p_reserva_id uuid,
  p_unit_id uuid,
  p_organization_id uuid
)
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
      AND (
        (u.role IN ('supervisor', 'admin') AND u.organization_id = p_organization_id)
        OR (u.role = 'operator' AND u.reserva_id = p_reserva_id)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.user_can_access_reserva(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_access_reserva(uuid, uuid, uuid) TO authenticated;

-- RLS reservas
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reservas_member_select" ON public.reservas;
CREATE POLICY "reservas_member_select" ON public.reservas
  FOR SELECT TO authenticated
  USING (
    public.is_active_operator()
    AND organization_id = public.current_organization_id()
  );

-- Substituir políticas unit_scoped por reserva_scoped
DROP POLICY IF EXISTS "persons_unit_scoped_rw" ON public.persons;
CREATE POLICY "persons_reserva_scoped_rw" ON public.persons
  FOR ALL TO authenticated
  USING (
    public.is_active_operator()
    AND public.user_can_access_reserva(reserva_id, unit_id, organization_id)
  )
  WITH CHECK (
    public.is_active_operator()
    AND public.user_can_access_reserva(reserva_id, unit_id, organization_id)
  );

DROP POLICY IF EXISTS "materials_unit_scoped_rw" ON public.materials;
CREATE POLICY "materials_reserva_scoped_rw" ON public.materials
  FOR ALL TO authenticated
  USING (
    public.is_active_operator()
    AND public.user_can_access_reserva(reserva_id, unit_id, organization_id)
  )
  WITH CHECK (
    public.is_active_operator()
    AND public.user_can_access_reserva(reserva_id, unit_id, organization_id)
  );

DROP POLICY IF EXISTS "cautelas_unit_scoped_rw" ON public.cautelas;
CREATE POLICY "cautelas_reserva_scoped_rw" ON public.cautelas
  FOR ALL TO authenticated
  USING (
    public.is_active_operator()
    AND public.user_can_access_reserva(reserva_id, unit_id, organization_id)
  )
  WITH CHECK (
    public.is_active_operator()
    AND public.user_can_access_reserva(reserva_id, unit_id, organization_id)
  );

DROP POLICY IF EXISTS "cautela_items_unit_scoped_rw" ON public.cautela_items;
CREATE POLICY "cautela_items_reserva_scoped_rw" ON public.cautela_items
  FOR ALL TO authenticated
  USING (
    public.is_active_operator()
    AND public.user_can_access_reserva(reserva_id, unit_id, organization_id)
  )
  WITH CHECK (
    public.is_active_operator()
    AND public.user_can_access_reserva(reserva_id, unit_id, organization_id)
  );

DROP POLICY IF EXISTS "divergences_unit_scoped_rw" ON public.divergences;
CREATE POLICY "divergences_reserva_scoped_rw" ON public.divergences
  FOR ALL TO authenticated
  USING (
    public.is_active_operator()
    AND public.user_can_access_reserva(reserva_id, unit_id, organization_id)
  )
  WITH CHECK (
    public.is_active_operator()
    AND public.user_can_access_reserva(reserva_id, unit_id, organization_id)
  );

DROP POLICY IF EXISTS "audit_logs_unit_scoped_select" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_unit_scoped_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_reserva_scoped_select" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    public.is_active_operator()
    AND public.user_can_access_reserva(reserva_id, unit_id, organization_id)
  );
CREATE POLICY "audit_logs_reserva_scoped_insert" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_operator()
    AND public.user_can_access_reserva(reserva_id, unit_id, organization_id)
  );

DROP POLICY IF EXISTS "corrections_unit_scoped_select" ON public.corrections;
DROP POLICY IF EXISTS "corrections_unit_scoped_insert" ON public.corrections;
CREATE POLICY "corrections_reserva_scoped_select" ON public.corrections
  FOR SELECT TO authenticated
  USING (
    public.is_active_operator()
    AND public.user_can_access_reserva(reserva_id, unit_id, organization_id)
  );
CREATE POLICY "corrections_reserva_scoped_insert" ON public.corrections
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_operator()
    AND public.user_can_access_reserva(reserva_id, unit_id, organization_id)
  );

DROP POLICY IF EXISTS "ammo_batches_unit_scoped_select" ON public.ammo_batches;
DROP POLICY IF EXISTS "ammo_batches_unit_scoped_insert" ON public.ammo_batches;
DROP POLICY IF EXISTS "ammo_batches_unit_scoped_update" ON public.ammo_batches;

CREATE POLICY "ammo_batches_reserva_scoped_select" ON public.ammo_batches
  FOR SELECT TO authenticated
  USING (
    public.is_active_operator()
    AND public.user_can_access_reserva(reserva_id, unit_id, organization_id)
  );
CREATE POLICY "ammo_batches_reserva_scoped_insert" ON public.ammo_batches
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_operator()
    AND public.user_can_access_reserva(reserva_id, unit_id, organization_id)
  );
CREATE POLICY "ammo_batches_reserva_scoped_update" ON public.ammo_batches
  FOR UPDATE TO authenticated
  USING (
    public.is_active_operator()
    AND public.user_can_access_reserva(reserva_id, unit_id, organization_id)
  )
  WITH CHECK (
    public.is_active_operator()
    AND public.user_can_access_reserva(reserva_id, unit_id, organization_id)
  );

-- create_cautela_atomic: grava reserva_id
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
  v_reserva_id uuid;
BEGIN
  IF v_operator_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT organization_id, unit_id, reserva_id
  INTO v_org_id, v_unit_id, v_reserva_id
  FROM public.usuarios
  WHERE auth_user_id = v_operator_id AND is_active
  LIMIT 1;

  IF v_org_id IS NULL OR v_unit_id IS NULL OR v_reserva_id IS NULL THEN
    RAISE EXCEPTION 'OPERATOR_NO_TENANT';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.persons p
    WHERE p.id = p_person_id AND p.reserva_id = v_reserva_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.auth_user_id = v_operator_id
      AND u.is_active
      AND u.role IN ('supervisor', 'admin')
      AND u.organization_id = v_org_id
  ) THEN
    RAISE EXCEPTION 'PERSON_RESERVA_MISMATCH';
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
      AND reserva_id = v_reserva_id
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

  INSERT INTO public.cautelas (
    person_id, operator_id, type, status, notes,
    organization_id, unit_id, reserva_id
  )
  VALUES (p_person_id, v_operator_id, p_type, 'open', p_notes, v_org_id, v_unit_id, v_reserva_id)
  RETURNING id INTO v_cautela_id;

  FOR r IN SELECT material_id, quantity FROM _cautela_merge ORDER BY material_id
  LOOP
    INSERT INTO public.cautela_items (
      cautela_id, material_id, status, quantity_delivered,
      organization_id, unit_id, reserva_id
    )
    VALUES (v_cautela_id, r.material_id, 'pending', r.quantity, v_org_id, v_unit_id, v_reserva_id)
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

-- Remover tabela categories órfã (vazia)
DROP TABLE IF EXISTS public.categories CASCADE;

INSERT INTO public.audit_logs (action, entity, entity_id, after_state, organization_id, unit_id, reserva_id)
SELECT
  'etapa1_reservas_bootstrap',
  'reservas',
  r.id,
  jsonb_build_object('reservas_total', (SELECT count(*) FROM public.reservas)),
  r.organization_id,
  r.unit_id,
  r.id
FROM public.reservas r
WHERE r.code = 'RES-1BPM'
LIMIT 1;

COMMENT ON TABLE public.reservas IS 'Reserva física de material por unidade (batalhão). Evolução do plano batalhoes/reservas.';
COMMENT ON TABLE public.units IS 'Unidade operacional (= batalhão no domínio).';
COMMENT ON TABLE public.organizations IS 'Organização institucional (ex.: 1º BPM).';
