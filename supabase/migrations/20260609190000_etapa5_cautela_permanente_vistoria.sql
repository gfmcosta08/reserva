-- Etapa 5 — Cautela permanente / vistoria anual (review_date + movimentação VISTORIA)

-- 1. Próxima vistoria anual (1 ano após data base)
CREATE OR REPLACE FUNCTION public.calc_annual_review_date(p_base TIMESTAMPTZ DEFAULT now())
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
AS $$
  SELECT p_base + interval '1 year';
$$;

REVOKE ALL ON FUNCTION public.calc_annual_review_date(TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calc_annual_review_date(TIMESTAMPTZ) TO authenticated;

COMMENT ON COLUMN public.cautelas.review_date IS
  'Data prevista da próxima vistoria anual (cautelas permanentes abertas).';

-- Backfill: cautelas permanentes abertas sem review_date
UPDATE public.cautelas
SET review_date = public.calc_annual_review_date(created_at)
WHERE type = 'permanent'
  AND status IN ('open', 'partial')
  AND review_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_cautelas_permanent_review_date
  ON public.cautelas (review_date)
  WHERE type = 'permanent' AND status IN ('open', 'partial');

-- 2. Views: vistorias pendentes (próximos 30 dias) e atrasadas
CREATE OR REPLACE VIEW public.v_vistorias_pendentes
WITH (security_invoker = true)
AS
SELECT
  c.id AS cautela_id,
  c.person_id,
  per.full_name AS person_name,
  per.rg AS person_rg,
  c.review_date,
  c.created_at AS cautela_created_at,
  c.organization_id,
  c.unit_id,
  c.reserva_id,
  (c.review_date::date - (now() AT TIME ZONE 'America/Sao_Paulo')::date) AS dias_restantes,
  (
    SELECT count(*)::int
    FROM public.cautela_items ci
    WHERE ci.cautela_id = c.id
      AND ci.status = 'pending'
  ) AS items_pendentes
FROM public.cautelas c
LEFT JOIN public.persons per ON per.id = c.person_id
WHERE c.type = 'permanent'
  AND c.status IN ('open', 'partial')
  AND c.review_date IS NOT NULL
  AND c.review_date >= now()
  AND c.review_date <= now() + interval '30 days';

COMMENT ON VIEW public.v_vistorias_pendentes IS
  'Cautelas permanentes com vistoria anual nos próximos 30 dias (Etapa 5).';

GRANT SELECT ON public.v_vistorias_pendentes TO authenticated;

CREATE OR REPLACE VIEW public.v_vistorias_atrasadas
WITH (security_invoker = true)
AS
SELECT
  c.id AS cautela_id,
  c.person_id,
  per.full_name AS person_name,
  per.rg AS person_rg,
  c.review_date,
  c.created_at AS cautela_created_at,
  c.organization_id,
  c.unit_id,
  c.reserva_id,
  ((now() AT TIME ZONE 'America/Sao_Paulo')::date - c.review_date::date) AS dias_atraso,
  (
    SELECT count(*)::int
    FROM public.cautela_items ci
    WHERE ci.cautela_id = c.id
      AND ci.status = 'pending'
  ) AS items_pendentes
FROM public.cautelas c
LEFT JOIN public.persons per ON per.id = c.person_id
WHERE c.type = 'permanent'
  AND c.status IN ('open', 'partial')
  AND c.review_date IS NOT NULL
  AND c.review_date < now();

COMMENT ON VIEW public.v_vistorias_atrasadas IS
  'Cautelas permanentes com vistoria anual vencida (Etapa 5).';

GRANT SELECT ON public.v_vistorias_atrasadas TO authenticated;

CREATE OR REPLACE FUNCTION public.count_vistorias_pendentes()
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int FROM public.v_vistorias_pendentes;
$$;

CREATE OR REPLACE FUNCTION public.count_vistorias_atrasadas()
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int FROM public.v_vistorias_atrasadas;
$$;

REVOKE ALL ON FUNCTION public.count_vistorias_pendentes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.count_vistorias_atrasadas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_vistorias_pendentes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_vistorias_atrasadas() TO authenticated;

-- 3. Registrar vistoria anual: movimentação VISTORIA + renova review_date
CREATE OR REPLACE FUNCTION public.registrar_vistoria(
  p_cautela_id UUID,
  p_observacao TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_operator_id UUID;
  v_c RECORD;
  v_item RECORD;
  v_mov_ids UUID[] := '{}';
  v_mov_id UUID;
  v_next_review TIMESTAMPTZ;
BEGIN
  v_operator_id := auth.uid();
  IF v_operator_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT c.*, u.organization_id AS op_org, u.unit_id AS op_unit, u.reserva_id AS op_reserva
  INTO v_c
  FROM public.cautelas c
  JOIN public.usuarios u ON u.auth_user_id = v_operator_id AND u.is_active
  WHERE c.id = p_cautela_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CAUTELA_NOT_FOUND';
  END IF;

  IF NOT public.user_can_access_reserva(v_c.reserva_id, v_c.unit_id, v_c.organization_id) THEN
    RAISE EXCEPTION 'CAUTELA_ACCESS_DENIED';
  END IF;

  IF v_c.type <> 'permanent' THEN
    RAISE EXCEPTION 'NOT_PERMANENT_CAUTELA';
  END IF;

  IF v_c.status NOT IN ('open', 'partial') THEN
    RAISE EXCEPTION 'CAUTELA_NOT_OPEN';
  END IF;

  FOR v_item IN
    SELECT ci.id, ci.material_id, ci.quantity_delivered, m.stock_quantity, m.status_atual
    FROM public.cautela_items ci
    JOIN public.materials m ON m.id = ci.material_id
    WHERE ci.cautela_id = p_cautela_id
      AND ci.status = 'pending'
    ORDER BY ci.id
  LOOP
    v_mov_id := public.aplicar_movimentacao_material(
      v_item.material_id,
      'VISTORIA'::public.tipo_movimentacao,
      COALESCE(v_item.stock_quantity, 1),
      COALESCE(v_item.status_atual, 'CAUTELADO_PERMANENTE'::public.status_material),
      GREATEST(v_item.quantity_delivered, 1),
      v_c.person_id,
      'EM_CAUTELA',
      p_cautela_id,
      v_item.id,
      v_operator_id,
      COALESCE(p_observacao, 'Vistoria anual registrada')
    );
    v_mov_ids := array_append(v_mov_ids, v_mov_id);
  END LOOP;

  IF cardinality(v_mov_ids) = 0 THEN
    RAISE EXCEPTION 'NO_PENDING_ITEMS';
  END IF;

  v_next_review := public.calc_annual_review_date(now());

  UPDATE public.cautelas
  SET review_date = v_next_review
  WHERE id = p_cautela_id;

  RETURN jsonb_build_object(
    'cautela_id', p_cautela_id,
    'movimentacao_ids', to_jsonb(v_mov_ids),
    'next_review_date', v_next_review
  );
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_vistoria(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_vistoria(UUID, TEXT) TO authenticated;

-- 4. create_cautela_atomic: review_date para permanent (param opcional ou +1 ano)
DROP FUNCTION IF EXISTS public.create_cautela_atomic(uuid, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.create_cautela_atomic(
  p_person_id uuid,
  p_type text,
  p_notes text,
  p_items jsonb,
  p_review_date timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_operator_id uuid;
  v_org_id uuid;
  v_unit_id uuid;
  v_reserva_id uuid;
  v_cautela_id uuid;
  v_id uuid;
  v_item_ids uuid[] := '{}';
  v_distinct_ids uuid[];
  r RECORD;
  v_stock int;
  v_status text;
  v_status_atual public.status_material;
  v_new_stock int;
  v_cautela_status public.status_material;
  v_tipo_saida public.tipo_movimentacao;
  v_reserva_name text;
  v_deadline timestamptz;
  v_review_date timestamptz;
BEGIN
  v_operator_id := auth.uid();
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

  SELECT name INTO v_reserva_name FROM public.reservas WHERE id = v_reserva_id;

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

  IF p_type NOT IN ('daily', 'permanent') THEN
    RAISE EXCEPTION 'INVALID_CAUTELA_TYPE';
  END IF;

  v_cautela_status := CASE WHEN p_type = 'permanent' THEN 'CAUTELADO_PERMANENTE' ELSE 'CAUTELADO_TEMPORARIO' END;
  v_tipo_saida := CASE WHEN p_type = 'permanent' THEN 'CAUTELA_PERMANENTE' ELSE 'CAUTELA_SAIDA' END;
  v_deadline := CASE WHEN p_type = 'daily' THEN public.calc_daily_return_deadline(now()) ELSE NULL END;
  v_review_date := CASE
    WHEN p_type = 'permanent' THEN COALESCE(p_review_date, public.calc_annual_review_date(now()))
    ELSE NULL
  END;

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
    SELECT stock_quantity, status, status_atual
    INTO v_stock, v_status, v_status_atual
    FROM public.materials
    WHERE id = r.material_id
      AND reserva_id = v_reserva_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'MATERIAL_NOT_FOUND';
    END IF;

    IF v_status_atual IS DISTINCT FROM 'DISPONIVEL' AND v_status <> 'available' THEN
      RAISE EXCEPTION 'MATERIALS_NOT_ALL_AVAILABLE';
    END IF;

    IF v_stock < r.quantity THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK';
    END IF;
  END LOOP;

  INSERT INTO public.cautelas (
    person_id, operator_id, type, status, notes,
    organization_id, unit_id, reserva_id,
    data_prevista_devolucao, review_date
  )
  VALUES (
    p_person_id, v_operator_id, p_type, 'open', p_notes,
    v_org_id, v_unit_id, v_reserva_id,
    v_deadline, v_review_date
  )
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

    SELECT stock_quantity INTO v_stock FROM public.materials WHERE id = r.material_id;
    v_new_stock := GREATEST(0, v_stock - r.quantity);

    PERFORM public.aplicar_movimentacao_material(
      r.material_id,
      v_tipo_saida,
      v_new_stock,
      CASE
        WHEN v_new_stock > 0 THEN 'DISPONIVEL'::public.status_material
        ELSE v_cautela_status
      END,
      r.quantity,
      CASE WHEN v_new_stock <= 0 THEN p_person_id ELSE NULL END,
      CASE WHEN v_new_stock <= 0 THEN 'EM_CAUTELA' ELSE COALESCE(v_reserva_name, 'RESERVA') END,
      v_cautela_id,
      v_id,
      v_operator_id,
      NULL
    );
  END LOOP;

  RETURN jsonb_build_object(
    'cautela_id', v_cautela_id,
    'cautela_item_ids', to_jsonb(v_item_ids),
    'review_date', v_review_date
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_cautela_atomic(uuid, text, text, jsonb, timestamptz) TO authenticated;
