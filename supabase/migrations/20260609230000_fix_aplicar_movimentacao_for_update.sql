-- Fix: FOR UPDATE não pode ser aplicado ao lado nullable de LEFT JOIN (materials + reservas)

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
  v_reserva_name TEXT;
BEGIN
  SELECT
    m.id,
    m.stock_quantity,
    m.status_atual,
    m.localizacao_atual,
    m.person_responsavel_id,
    m.organization_id,
    m.unit_id,
    m.reserva_id
  INTO v_m
  FROM public.materials m
  WHERE m.id = p_material_id
  FOR UPDATE OF m;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATERIAL_NOT_FOUND';
  END IF;

  SELECT r.name INTO v_reserva_name
  FROM public.reservas r
  WHERE r.id = v_m.reserva_id;

  v_loc := COALESCE(p_localizacao_nova, v_m.localizacao_atual, v_reserva_name, 'RESERVA');

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
