-- Estoque pode zerar após cautela; RPC decrementa e restaura na devolução.

ALTER TABLE public.materials
  DROP CONSTRAINT IF EXISTS materials_stock_quantity_check;

ALTER TABLE public.materials
  ADD CONSTRAINT materials_stock_quantity_check CHECK (stock_quantity >= 0);

COMMENT ON COLUMN public.materials.stock_quantity IS 'Unidades em estoque. 0 = esgotado (status cautelado). Armas unitárias usam 1.';

-- Cautela atômica: valida e decrementa stock_quantity; mantém available se sobrar estoque.

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
BEGIN
  IF v_operator_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
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

  INSERT INTO public.cautelas (person_id, operator_id, type, status, notes)
  VALUES (p_person_id, v_operator_id, p_type, 'open', p_notes)
  RETURNING id INTO v_cautela_id;

  FOR r IN SELECT material_id, quantity FROM _cautela_merge ORDER BY material_id
  LOOP
    INSERT INTO public.cautela_items (cautela_id, material_id, status, quantity_delivered)
    VALUES (v_cautela_id, r.material_id, 'pending', r.quantity)
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

COMMENT ON FUNCTION public.create_cautela_atomic IS 'Cria cautela, decrementa stock_quantity e mantém available se sobrar estoque.';
