-- Etapa 4 — Cautela temporária (daily): prazo de devolução, view de materiais em cautela aberta,
-- índices e create_cautela_atomic com data_prevista_devolucao.

-- 1. Prazo de devolução para cautelas diárias
ALTER TABLE public.cautelas
  ADD COLUMN IF NOT EXISTS data_prevista_devolucao TIMESTAMPTZ;

COMMENT ON COLUMN public.cautelas.data_prevista_devolucao IS
  'Fim do dia operacional (America/Sao_Paulo) para devolução de cautela diária.';

CREATE OR REPLACE FUNCTION public.calc_daily_return_deadline(p_created_at TIMESTAMPTZ DEFAULT now())
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
AS $$
  SELECT (
    date_trunc('day', p_created_at AT TIME ZONE 'America/Sao_Paulo')
    + interval '1 day'
    - interval '1 second'
  ) AT TIME ZONE 'America/Sao_Paulo';
$$;

REVOKE ALL ON FUNCTION public.calc_daily_return_deadline(TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calc_daily_return_deadline(TIMESTAMPTZ) TO authenticated;

UPDATE public.cautelas
SET data_prevista_devolucao = public.calc_daily_return_deadline(created_at)
WHERE type = 'daily'
  AND data_prevista_devolucao IS NULL;

CREATE INDEX IF NOT EXISTS idx_cautelas_daily_open_deadline
  ON public.cautelas (data_prevista_devolucao)
  WHERE type = 'daily' AND status IN ('open', 'partial');

CREATE INDEX IF NOT EXISTS idx_cautelas_daily_type_status
  ON public.cautelas (type, status)
  WHERE type = 'daily';

-- 2. View: materiais em cautela temporária aberta (saldo pendente)
CREATE OR REPLACE VIEW public.v_materiais_cautela_temporaria_aberta
WITH (security_invoker = true)
AS
SELECT
  m.id AS material_id,
  m.patrimony_number,
  m.name AS material_name,
  m.status_atual,
  m.person_responsavel_id,
  per.full_name AS responsavel_nome,
  per.rg AS responsavel_rg,
  c.id AS cautela_id,
  c.created_at AS cautela_created_at,
  c.data_prevista_devolucao,
  ci.id AS cautela_item_id,
  ci.quantity_delivered,
  COALESCE(ci.quantity_returned, 0) AS quantity_returned,
  GREATEST(ci.quantity_delivered - COALESCE(ci.quantity_returned, 0), 0) AS quantity_pendente,
  c.reserva_id,
  c.unit_id,
  c.organization_id
FROM public.cautelas c
JOIN public.cautela_items ci ON ci.cautela_id = c.id
JOIN public.materials m ON m.id = ci.material_id
LEFT JOIN public.persons per ON per.id = c.person_id
WHERE c.type = 'daily'
  AND c.status IN ('open', 'partial')
  AND ci.status IN ('pending')
  AND COALESCE(ci.quantity_returned, 0) < ci.quantity_delivered;

COMMENT ON VIEW public.v_materiais_cautela_temporaria_aberta IS
  'Materiais com saldo pendente em cautelas diárias abertas (Etapa 4).';

GRANT SELECT ON public.v_materiais_cautela_temporaria_aberta TO authenticated;

-- 3. Helper: contagem de materiais em cautela temporária aberta
CREATE OR REPLACE FUNCTION public.count_materiais_cautela_temporaria_aberta()
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int FROM public.v_materiais_cautela_temporaria_aberta;
$$;

REVOKE ALL ON FUNCTION public.count_materiais_cautela_temporaria_aberta() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_materiais_cautela_temporaria_aberta() TO authenticated;

-- 4. create_cautela_atomic: grava data_prevista_devolucao para daily
CREATE OR REPLACE FUNCTION public.create_cautela_atomic(
  p_person_id uuid,
  p_type text,
  p_notes text,
  p_items jsonb
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
    organization_id, unit_id, reserva_id, data_prevista_devolucao
  )
  VALUES (
    p_person_id, v_operator_id, p_type, 'open', p_notes,
    v_org_id, v_unit_id, v_reserva_id, v_deadline
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
    'cautela_item_ids', to_jsonb(v_item_ids)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_cautela_atomic(uuid, text, text, jsonb) TO authenticated;
