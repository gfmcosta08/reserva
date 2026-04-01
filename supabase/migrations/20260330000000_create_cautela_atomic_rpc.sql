-- Transação atômica: criar cautela + itens + marcar materiais como cautelado.
-- Evita estado inconsistente se uma etapa falhar no meio do fluxo.

CREATE OR REPLACE FUNCTION public.create_cautela_atomic(
  p_person_id uuid,
  p_operator_id uuid,
  p_type text,
  p_notes text,
  p_material_ids uuid[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cautela_id uuid;
  v_item_ids uuid[] := ARRAY[]::uuid[];
  v_id uuid;
  m uuid;
  v_available int;
  v_expected int;
BEGIN
  IF p_material_ids IS NULL OR cardinality(p_material_ids) = 0 THEN
    RAISE EXCEPTION 'EMPTY_MATERIALS';
  END IF;

  v_expected := cardinality(p_material_ids);

  SELECT COUNT(*)::int INTO v_available
  FROM public.materials
  WHERE id = ANY (p_material_ids)
    AND status = 'available';

  IF v_available <> v_expected THEN
    RAISE EXCEPTION 'MATERIALS_NOT_ALL_AVAILABLE';
  END IF;

  INSERT INTO public.cautelas (person_id, operator_id, type, status, notes)
  VALUES (p_person_id, p_operator_id, p_type, 'open', p_notes)
  RETURNING id INTO v_cautela_id;

  FOREACH m IN ARRAY p_material_ids
  LOOP
    INSERT INTO public.cautela_items (cautela_id, material_id, status)
    VALUES (v_cautela_id, m, 'pending')
    RETURNING id INTO v_id;
    v_item_ids := array_append(v_item_ids, v_id);
  END LOOP;

  UPDATE public.materials
  SET status = 'cautelado', updated_at = now()
  WHERE id = ANY (p_material_ids);

  RETURN jsonb_build_object(
    'cautela_id', v_cautela_id,
    'cautela_item_ids', to_jsonb(v_item_ids)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_cautela_atomic(uuid, uuid, text, text, uuid[]) TO authenticated;

COMMENT ON FUNCTION public.create_cautela_atomic IS 'Cria cautela, itens e atualiza materiais em uma única transação.';
