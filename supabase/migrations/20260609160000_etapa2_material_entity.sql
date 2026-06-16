-- Etapa 2 — Entidade MATERIAL: ENUM status/tipo, responsável, localização (teste_db primeiro)

DO $$ BEGIN
  CREATE TYPE public.status_material AS ENUM (
    'DISPONIVEL',
    'CAUTELADO_TEMPORARIO',
    'CAUTELADO_PERMANENTE',
    'MANUTENCAO',
    'BLOQUEADO',
    'BAIXADO',
    'EXTRAVIADO',
    'PENDENTE_DEVOLUCAO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.tipo_material AS ENUM (
    'ARMA_CURTA',
    'ARMA_LONGA',
    'CARREGADOR',
    'MUNICAO',
    'COLETE',
    'CAPACETE',
    'CELULAR',
    'TRANSCEPTOR',
    'ALGEMA',
    'BORNAL',
    'IMPRESSORA',
    'TASER',
    'OUTRO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS status_atual public.status_material,
  ADD COLUMN IF NOT EXISTS tipo_material public.tipo_material,
  ADD COLUMN IF NOT EXISTS person_responsavel_id UUID REFERENCES public.persons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS localizacao_atual TEXT;

CREATE OR REPLACE FUNCTION public.legacy_status_to_enum(p_status TEXT)
RETURNS public.status_material
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE COALESCE(p_status, 'available')
    WHEN 'available' THEN 'DISPONIVEL'::public.status_material
    WHEN 'in_use' THEN 'CAUTELADO_TEMPORARIO'::public.status_material
    WHEN 'cautelado' THEN 'CAUTELADO_TEMPORARIO'::public.status_material
    WHEN 'maintenance' THEN 'MANUTENCAO'::public.status_material
    WHEN 'blocked' THEN 'BLOQUEADO'::public.status_material
    WHEN 'unavailable' THEN 'BAIXADO'::public.status_material
    WHEN 'pending_return' THEN 'PENDENTE_DEVOLUCAO'::public.status_material
    ELSE 'DISPONIVEL'::public.status_material
  END;
$$;

CREATE OR REPLACE FUNCTION public.enum_status_to_legacy(p_status public.status_material)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_status
    WHEN 'DISPONIVEL' THEN 'available'
    WHEN 'CAUTELADO_TEMPORARIO' THEN 'cautelado'
    WHEN 'CAUTELADO_PERMANENTE' THEN 'cautelado'
    WHEN 'MANUTENCAO' THEN 'maintenance'
    WHEN 'BLOQUEADO' THEN 'blocked'
    WHEN 'BAIXADO' THEN 'unavailable'
    WHEN 'EXTRAVIADO' THEN 'unavailable'
    WHEN 'PENDENTE_DEVOLUCAO' THEN 'pending_return'
    ELSE 'available'
  END;
$$;

CREATE OR REPLACE FUNCTION public.category_to_tipo_material(p_category TEXT)
RETURNS public.tipo_material
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE upper(
    translate(trim(COALESCE(p_category, '')), 'Çç', 'Cc')
  )
    WHEN 'ARMA CURTA' THEN 'ARMA_CURTA'::public.tipo_material
    WHEN 'PISTOLA' THEN 'ARMA_CURTA'::public.tipo_material
    WHEN 'ARMA LONGA' THEN 'ARMA_LONGA'::public.tipo_material
    WHEN 'CARREGADOR' THEN 'CARREGADOR'::public.tipo_material
    WHEN 'MUNIÇÃO' THEN 'MUNICAO'::public.tipo_material
    WHEN 'MUNICAO' THEN 'MUNICAO'::public.tipo_material
    WHEN 'COLETE' THEN 'COLETE'::public.tipo_material
    WHEN 'CAPACETE' THEN 'CAPACETE'::public.tipo_material
    WHEN 'CELULAR' THEN 'CELULAR'::public.tipo_material
    WHEN 'TRANSCEPTOR' THEN 'TRANSCEPTOR'::public.tipo_material
    WHEN 'ALGEMA' THEN 'ALGEMA'::public.tipo_material
    WHEN 'BORNAL' THEN 'BORNAL'::public.tipo_material
    WHEN 'IMPRESSORA' THEN 'IMPRESSORA'::public.tipo_material
    WHEN 'TASER' THEN 'TASER'::public.tipo_material
    ELSE 'OUTRO'::public.tipo_material
  END;
$$;

-- Backfill status_atual a partir de status legado
UPDATE public.materials m
SET status_atual = public.legacy_status_to_enum(m.status)
WHERE m.status_atual IS NULL;

-- Refinar cautelados: permanente vs temporário via cautela aberta
UPDATE public.materials m
SET status_atual = CASE
  WHEN EXISTS (
    SELECT 1
    FROM public.cautela_items ci
    JOIN public.cautelas c ON c.id = ci.cautela_id
    WHERE ci.material_id = m.id
      AND c.status = 'open'
      AND c.type = 'permanent'
      AND ci.status IN ('pending', 'partial')
  ) THEN 'CAUTELADO_PERMANENTE'::public.status_material
  WHEN m.status IN ('cautelado', 'in_use')
    OR EXISTS (
      SELECT 1
      FROM public.cautela_items ci
      JOIN public.cautelas c ON c.id = ci.cautela_id
      WHERE ci.material_id = m.id
        AND c.status = 'open'
        AND ci.status IN ('pending', 'partial')
    ) THEN 'CAUTELADO_TEMPORARIO'::public.status_material
  ELSE m.status_atual
END
WHERE m.status_atual IS NOT NULL;

UPDATE public.materials m
SET tipo_material = public.category_to_tipo_material(m.category)
WHERE m.tipo_material IS NULL;

-- Responsável e localização a partir de cautelas abertas
UPDATE public.materials m
SET
  person_responsavel_id = sub.person_id,
  localizacao_atual = 'EM_CAUTELA'
FROM (
  SELECT DISTINCT ON (ci.material_id)
    ci.material_id,
    c.person_id
  FROM public.cautela_items ci
  JOIN public.cautelas c ON c.id = ci.cautela_id
  WHERE c.status = 'open'
    AND ci.status IN ('pending', 'partial')
  ORDER BY ci.material_id, c.created_at DESC
) sub
WHERE m.id = sub.material_id;

UPDATE public.materials m
SET localizacao_atual = COALESCE(r.name, 'RESERVA')
FROM public.reservas r
WHERE m.localizacao_atual IS NULL
  AND m.reserva_id = r.id
  AND m.status_atual = 'DISPONIVEL';

UPDATE public.materials
SET localizacao_atual = 'RESERVA'
WHERE localizacao_atual IS NULL;

ALTER TABLE public.materials
  ALTER COLUMN status_atual SET DEFAULT 'DISPONIVEL',
  ALTER COLUMN status_atual SET NOT NULL,
  ALTER COLUMN tipo_material SET DEFAULT 'OUTRO',
  ALTER COLUMN tipo_material SET NOT NULL;

-- Sincronização bidirecional status legado ↔ ENUM
CREATE OR REPLACE FUNCTION public.materials_bidirectional_status_sync()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status_atual IS NULL AND NEW.status IS NOT NULL THEN
      NEW.status_atual := public.legacy_status_to_enum(NEW.status);
    ELSIF NEW.status IS NULL AND NEW.status_atual IS NOT NULL THEN
      NEW.status := public.enum_status_to_legacy(NEW.status_atual);
    ELSIF NEW.status_atual IS NULL THEN
      NEW.status_atual := 'DISPONIVEL';
      NEW.status := 'available';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_atual := public.legacy_status_to_enum(NEW.status);
  ELSIF NEW.status_atual IS DISTINCT FROM OLD.status_atual THEN
    NEW.status := public.enum_status_to_legacy(NEW.status_atual);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_materials_status_sync ON public.materials;
CREATE TRIGGER trg_materials_status_sync
  BEFORE INSERT OR UPDATE ON public.materials
  FOR EACH ROW
  EXECUTE FUNCTION public.materials_bidirectional_status_sync();

CREATE OR REPLACE FUNCTION public.verificar_disponibilidade_material(p_material_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.materials m
    WHERE m.id = p_material_id
      AND m.status_atual = 'DISPONIVEL'
      AND COALESCE(m.stock_quantity, 1) > 0
  );
$$;

REVOKE ALL ON FUNCTION public.verificar_disponibilidade_material(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verificar_disponibilidade_material(UUID) TO authenticated;

-- create_cautela_atomic: valida DISPONIVEL + atualiza status_atual/responsável
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
  END LOOP;

  FOR r IN SELECT material_id, quantity FROM _cautela_merge ORDER BY material_id
  LOOP
    SELECT stock_quantity INTO v_stock FROM public.materials WHERE id = r.material_id;
    v_new_stock := GREATEST(0, v_stock - r.quantity);

    UPDATE public.materials
    SET
      stock_quantity = v_new_stock,
      status = CASE WHEN v_new_stock > 0 THEN 'available' ELSE 'cautelado' END,
      status_atual = CASE
        WHEN v_new_stock > 0 THEN 'DISPONIVEL'::public.status_material
        ELSE v_cautela_status
      END,
      person_responsavel_id = CASE
        WHEN v_new_stock <= 0 THEN p_person_id
        ELSE person_responsavel_id
      END,
      localizacao_atual = CASE
        WHEN v_new_stock <= 0 THEN 'EM_CAUTELA'
        ELSE localizacao_atual
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

INSERT INTO public.audit_logs (action, entity, entity_id, after_state, organization_id, unit_id, reserva_id)
SELECT
  'etapa2_material_entity',
  'materials',
  m.id,
  jsonb_build_object(
    'status_atual', m.status_atual::text,
    'tipo_material', m.tipo_material::text,
    'person_responsavel_id', m.person_responsavel_id,
    'localizacao_atual', m.localizacao_atual
  ),
  m.organization_id,
  m.unit_id,
  m.reserva_id
FROM public.materials m
LIMIT 1;
