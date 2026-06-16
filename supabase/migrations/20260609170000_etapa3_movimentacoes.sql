-- Etapa 3 — Movimentações imutáveis + cautela/devolução via registrar_movimentacao

DO $$ BEGIN
  CREATE TYPE public.tipo_movimentacao AS ENUM (
    'CAUTELA_SAIDA',
    'CAUTELA_ENTRADA',
    'CAUTELA_PERMANENTE',
    'MANUTENCAO',
    'EXTRAVIO',
    'BAIXA',
    'VISTORIA',
    'AJUSTE_ESTOQUE',
    'CADASTRO_INICIAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
  tipo public.tipo_movimentacao NOT NULL,
  status_anterior public.status_material,
  status_novo public.status_material NOT NULL,
  stock_anterior INT,
  stock_novo INT NOT NULL,
  quantidade INT NOT NULL DEFAULT 1,
  person_responsavel_id UUID REFERENCES public.persons(id) ON DELETE SET NULL,
  localizacao_anterior TEXT,
  localizacao_nova TEXT,
  cautela_id UUID REFERENCES public.cautelas(id) ON DELETE SET NULL,
  cautela_item_id UUID REFERENCES public.cautela_items(id) ON DELETE SET NULL,
  operador_id UUID,
  observacao TEXT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  unit_id UUID NOT NULL REFERENCES public.units(id),
  reserva_id UUID NOT NULL REFERENCES public.reservas(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_material_created
  ON public.movimentacoes (material_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_cautela
  ON public.movimentacoes (cautela_id) WHERE cautela_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movimentacoes_reserva
  ON public.movimentacoes (reserva_id);

ALTER TABLE public.movimentacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "movimentacoes_reserva_scoped_select" ON public.movimentacoes;
CREATE POLICY "movimentacoes_reserva_scoped_select" ON public.movimentacoes
  FOR SELECT TO authenticated
  USING (
    public.user_can_access_reserva(reserva_id, unit_id, organization_id)
  );

DROP POLICY IF EXISTS "movimentacoes_reserva_scoped_insert" ON public.movimentacoes;
CREATE POLICY "movimentacoes_reserva_scoped_insert" ON public.movimentacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_can_access_reserva(reserva_id, unit_id, organization_id)
  );

REVOKE UPDATE, DELETE ON public.movimentacoes FROM authenticated;
REVOKE UPDATE, DELETE ON public.movimentacoes FROM anon;

COMMENT ON TABLE public.movimentacoes IS
  'Cadeia de custódia append-only — toda alteração de estado de material em fluxos críticos.';

CREATE OR REPLACE FUNCTION public.stock_status_after_return_sql(
  p_stock_after_restore INT,
  p_item_status TEXT,
  p_qty_returned INT,
  p_qty_delivered INT
)
RETURNS public.status_material
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_item_status = 'damaged' THEN
    RETURN 'MANUTENCAO';
  ELSIF p_item_status = 'missing' THEN
    RETURN 'BAIXADO';
  ELSIF p_stock_after_restore > 0 THEN
    RETURN 'DISPONIVEL';
  ELSIF p_qty_returned >= p_qty_delivered THEN
    RETURN 'DISPONIVEL';
  ELSIF p_qty_returned > 0 THEN
    RETURN 'CAUTELADO_TEMPORARIO';
  END IF;
  RETURN 'CAUTELADO_TEMPORARIO';
END;
$$;

CREATE OR REPLACE FUNCTION public.aplicar_movimentacao_material(
  p_material_id UUID,
  p_tipo public.tipo_movimentacao,
  p_stock_novo INT,
  p_status_novo public.status_material,
  p_quantidade INT DEFAULT 1,
  p_person_responsavel_id UUID DEFAULT NULL,
  p_localizacao_nova TEXT DEFAULT NULL,
  p_cautela_id UUID DEFAULT NULL,
  p_cautela_item_id UUID DEFAULT NULL,
  p_operador_id UUID DEFAULT NULL,
  p_observacao TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_m RECORD;
  v_mov_id UUID;
  v_loc TEXT;
BEGIN
  SELECT
    m.id,
    m.stock_quantity,
    m.status_atual,
    m.localizacao_atual,
    m.person_responsavel_id,
    m.organization_id,
    m.unit_id,
    m.reserva_id,
    r.name AS reserva_name
  INTO v_m
  FROM public.materials m
  LEFT JOIN public.reservas r ON r.id = m.reserva_id
  WHERE m.id = p_material_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATERIAL_NOT_FOUND';
  END IF;

  v_loc := COALESCE(p_localizacao_nova, v_m.localizacao_atual, v_m.reserva_name, 'RESERVA');

  INSERT INTO public.movimentacoes (
    material_id, tipo, status_anterior, status_novo,
    stock_anterior, stock_novo, quantidade,
    person_responsavel_id, localizacao_anterior, localizacao_nova,
    cautela_id, cautela_item_id, operador_id, observacao,
    organization_id, unit_id, reserva_id
  )
  VALUES (
    p_material_id, p_tipo, v_m.status_atual, p_status_novo,
    COALESCE(v_m.stock_quantity, 1), p_stock_novo, GREATEST(p_quantidade, 1),
    p_person_responsavel_id, v_m.localizacao_atual, v_loc,
    p_cautela_id, p_cautela_item_id, p_operador_id, p_observacao,
    v_m.organization_id, v_m.unit_id, v_m.reserva_id
  )
  RETURNING id INTO v_mov_id;

  UPDATE public.materials
  SET
    stock_quantity = p_stock_novo,
    status_atual = p_status_novo,
    status = public.enum_status_to_legacy(p_status_novo),
    person_responsavel_id = CASE
      WHEN p_status_novo = 'DISPONIVEL' THEN NULL
      ELSE COALESCE(p_person_responsavel_id, person_responsavel_id)
    END,
    localizacao_atual = v_loc,
    updated_at = now()
  WHERE id = p_material_id;

  RETURN v_mov_id;
END;
$$;

REVOKE ALL ON FUNCTION public.aplicar_movimentacao_material(
  UUID, public.tipo_movimentacao, INT, public.status_material, INT, UUID, TEXT, UUID, UUID, UUID, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aplicar_movimentacao_material(
  UUID, public.tipo_movimentacao, INT, public.status_material, INT, UUID, TEXT, UUID, UUID, UUID, TEXT
) TO authenticated;

CREATE OR REPLACE FUNCTION public.registrar_movimentacao_devolucao(
  p_cautela_item_id UUID,
  p_previous_returned INT,
  p_new_returned INT,
  p_item_status TEXT,
  p_qty_delivered INT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_operator_id UUID;
  v_ci RECORD;
  v_stock INT;
  v_delta INT;
  v_stock_novo INT;
  v_status_novo public.status_material;
  v_tipo public.tipo_movimentacao;
  v_loc TEXT;
BEGIN
  v_operator_id := auth.uid();
  IF v_operator_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT
    ci.id,
    ci.material_id,
    ci.cautela_id,
    c.person_id,
    ci.reserva_id,
    ci.unit_id,
    ci.organization_id,
    m.stock_quantity,
    r.name AS reserva_name
  INTO v_ci
  FROM public.cautela_items ci
  JOIN public.cautelas c ON c.id = ci.cautela_id
  JOIN public.materials m ON m.id = ci.material_id
  LEFT JOIN public.reservas r ON r.id = m.reserva_id
  WHERE ci.id = p_cautela_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CAUTELA_ITEM_NOT_FOUND';
  END IF;

  IF NOT public.user_can_access_reserva(v_ci.reserva_id, v_ci.unit_id, v_ci.organization_id) THEN
    RAISE EXCEPTION 'RESERVA_ACCESS_DENIED';
  END IF;

  v_stock := COALESCE(v_ci.stock_quantity, 1);
  v_delta := GREATEST(0, p_new_returned - p_previous_returned);

  IF p_item_status IN ('damaged', 'missing') THEN
    v_stock_novo := v_stock;
    v_delta := 0;
  ELSE
    v_stock_novo := v_stock + v_delta;
  END IF;

  v_status_novo := public.stock_status_after_return_sql(
    v_stock_novo, p_item_status, p_new_returned, p_qty_delivered
  );

  v_tipo := CASE p_item_status
    WHEN 'damaged' THEN 'MANUTENCAO'::public.tipo_movimentacao
    WHEN 'missing' THEN 'EXTRAVIO'::public.tipo_movimentacao
    ELSE 'CAUTELA_ENTRADA'::public.tipo_movimentacao
  END;

  v_loc := CASE
    WHEN v_status_novo = 'DISPONIVEL' THEN COALESCE(v_ci.reserva_name, 'RESERVA')
    ELSE 'EM_CAUTELA'
  END;

  RETURN public.aplicar_movimentacao_material(
    v_ci.material_id,
    v_tipo,
    v_stock_novo,
    v_status_novo,
    GREATEST(v_delta, 1),
    CASE WHEN v_status_novo = 'DISPONIVEL' THEN NULL ELSE v_ci.person_id END,
    v_loc,
    v_ci.cautela_id,
    p_cautela_item_id,
    v_operator_id,
    NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_movimentacao_devolucao(UUID, INT, INT, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_movimentacao_devolucao(UUID, INT, INT, TEXT, INT) TO authenticated;

-- Backfill histórico a partir de cautelas existentes
INSERT INTO public.movimentacoes (
  material_id, tipo, status_anterior, status_novo,
  stock_anterior, stock_novo, quantidade,
  person_responsavel_id, localizacao_anterior, localizacao_nova,
  cautela_id, cautela_item_id, operador_id, observacao,
  organization_id, unit_id, reserva_id, created_at
)
SELECT
  ci.material_id,
  CASE WHEN c.type = 'permanent' THEN 'CAUTELA_PERMANENTE'::public.tipo_movimentacao
       ELSE 'CAUTELA_SAIDA'::public.tipo_movimentacao END,
  'DISPONIVEL'::public.status_material,
  CASE WHEN c.type = 'permanent' THEN 'CAUTELADO_PERMANENTE'::public.status_material
       ELSE 'CAUTELADO_TEMPORARIO'::public.status_material END,
  COALESCE(m.stock_quantity, 1) + GREATEST(ci.quantity_delivered, 1),
  COALESCE(m.stock_quantity, 1),
  GREATEST(ci.quantity_delivered, 1),
  c.person_id,
  COALESCE(res.name, 'RESERVA'),
  'EM_CAUTELA',
  c.id,
  ci.id,
  c.operator_id,
  'backfill_etapa3_saida',
  ci.organization_id,
  ci.unit_id,
  ci.reserva_id,
  c.created_at
FROM public.cautela_items ci
JOIN public.cautelas c ON c.id = ci.cautela_id
JOIN public.materials m ON m.id = ci.material_id
LEFT JOIN public.reservas res ON res.id = ci.reserva_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.movimentacoes mv
  WHERE mv.cautela_item_id = ci.id
    AND mv.tipo IN ('CAUTELA_SAIDA', 'CAUTELA_PERMANENTE')
);

INSERT INTO public.movimentacoes (
  material_id, tipo, status_anterior, status_novo,
  stock_anterior, stock_novo, quantidade,
  person_responsavel_id, localizacao_anterior, localizacao_nova,
  cautela_id, cautela_item_id, operador_id, observacao,
  organization_id, unit_id, reserva_id, created_at
)
SELECT
  ci.material_id,
  CASE ci.status
    WHEN 'damaged' THEN 'MANUTENCAO'::public.tipo_movimentacao
    WHEN 'missing' THEN 'EXTRAVIO'::public.tipo_movimentacao
    ELSE 'CAUTELA_ENTRADA'::public.tipo_movimentacao
  END,
  CASE WHEN c.type = 'permanent' THEN 'CAUTELADO_PERMANENTE'::public.status_material
       ELSE 'CAUTELADO_TEMPORARIO'::public.status_material END,
  public.stock_status_after_return_sql(
    COALESCE(m.stock_quantity, 1),
    ci.status,
    COALESCE(ci.quantity_returned, 0),
    GREATEST(ci.quantity_delivered, 1)
  ),
  COALESCE(m.stock_quantity, 1),
  COALESCE(m.stock_quantity, 1),
  GREATEST(COALESCE(ci.quantity_returned, 0), 1),
  NULL,
  'EM_CAUTELA',
  COALESCE(res.name, 'RESERVA'),
  c.id,
  ci.id,
  ci.returned_by,
  'backfill_etapa3_entrada',
  ci.organization_id,
  ci.unit_id,
  ci.reserva_id,
  COALESCE(ci.returned_at, c.closed_at, c.created_at)
FROM public.cautela_items ci
JOIN public.cautelas c ON c.id = ci.cautela_id
JOIN public.materials m ON m.id = ci.material_id
LEFT JOIN public.reservas res ON res.id = ci.reserva_id
WHERE ci.status IN ('returned', 'damaged', 'missing')
  AND NOT EXISTS (
    SELECT 1 FROM public.movimentacoes mv
    WHERE mv.cautela_item_id = ci.id
      AND mv.tipo IN ('CAUTELA_ENTRADA', 'MANUTENCAO', 'EXTRAVIO')
  );

-- create_cautela_atomic: saída via movimentação
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

  v_cautela_status := CASE WHEN p_type = 'permanent' THEN 'CAUTELADO_PERMANENTE' ELSE 'CAUTELADO_TEMPORARIO' END;
  v_tipo_saida := CASE WHEN p_type = 'permanent' THEN 'CAUTELA_PERMANENTE' ELSE 'CAUTELA_SAIDA' END;

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
