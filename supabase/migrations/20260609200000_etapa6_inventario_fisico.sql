-- Etapa 6 — Inventário físico (inventarios + inventario_itens)

DO $$ BEGIN
  CREATE TYPE public.inventario_status AS ENUM ('ABERTO', 'FECHADO', 'CANCELADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.inventario_item_status AS ENUM ('CONFERIDO', 'DIVERGENTE', 'NAO_ENCONTRADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.inventarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reserva_id UUID NOT NULL REFERENCES public.reservas(id) ON DELETE RESTRICT,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  operador_id UUID NOT NULL,
  status public.inventario_status NOT NULL DEFAULT 'ABERTO',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventario_itens (
  inventario_id UUID NOT NULL REFERENCES public.inventarios(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
  status public.inventario_item_status NOT NULL DEFAULT 'CONFERIDO',
  observacao TEXT,
  conferido_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  reserva_id UUID NOT NULL REFERENCES public.reservas(id) ON DELETE RESTRICT,
  PRIMARY KEY (inventario_id, material_id)
);

CREATE INDEX IF NOT EXISTS inventarios_reserva_id_idx ON public.inventarios (reserva_id);
CREATE INDEX IF NOT EXISTS inventarios_status_idx ON public.inventarios (status);
CREATE INDEX IF NOT EXISTS inventarios_started_at_idx ON public.inventarios (started_at DESC);
CREATE INDEX IF NOT EXISTS inventario_itens_material_id_idx ON public.inventario_itens (material_id);
CREATE INDEX IF NOT EXISTS inventario_itens_status_idx ON public.inventario_itens (status);

ALTER TABLE public.inventarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventario_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventarios_reserva_scoped_rw" ON public.inventarios;
CREATE POLICY "inventarios_reserva_scoped_rw" ON public.inventarios
  FOR ALL TO authenticated
  USING (
    public.is_active_operator()
    AND public.user_can_access_reserva(reserva_id, unit_id, organization_id)
  )
  WITH CHECK (
    public.is_active_operator()
    AND public.user_can_access_reserva(reserva_id, unit_id, organization_id)
  );

DROP POLICY IF EXISTS "inventario_itens_reserva_scoped_rw" ON public.inventario_itens;
CREATE POLICY "inventario_itens_reserva_scoped_rw" ON public.inventario_itens
  FOR ALL TO authenticated
  USING (
    public.is_active_operator()
    AND public.user_can_access_reserva(reserva_id, unit_id, organization_id)
  )
  WITH CHECK (
    public.is_active_operator()
    AND public.user_can_access_reserva(reserva_id, unit_id, organization_id)
  );

-- Fechar inventário: contagens + divergências opcionais para itens problemáticos
CREATE OR REPLACE FUNCTION public.fechar_inventario(p_inventario_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv RECORD;
  v_item RECORD;
  v_operator_id UUID;
  v_conferidos INT := 0;
  v_divergentes INT := 0;
  v_nao_encontrados INT := 0;
  v_total INT := 0;
  v_divergencias_criadas INT := 0;
  v_mat RECORD;
BEGIN
  v_operator_id := auth.uid();
  IF v_operator_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT i.*
  INTO v_inv
  FROM public.inventarios i
  WHERE i.id = p_inventario_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVENTARIO_NOT_FOUND';
  END IF;

  IF v_inv.status <> 'ABERTO' THEN
    RAISE EXCEPTION 'INVENTARIO_NOT_OPEN';
  END IF;

  IF NOT public.user_can_access_reserva(v_inv.reserva_id, v_inv.unit_id, v_inv.organization_id) THEN
    RAISE EXCEPTION 'INVENTARIO_ACCESS_DENIED';
  END IF;

  SELECT
    count(*)::int,
    count(*) FILTER (WHERE status = 'CONFERIDO')::int,
    count(*) FILTER (WHERE status = 'DIVERGENTE')::int,
    count(*) FILTER (WHERE status = 'NAO_ENCONTRADO')::int
  INTO v_total, v_conferidos, v_divergentes, v_nao_encontrados
  FROM public.inventario_itens
  WHERE inventario_id = p_inventario_id;

  FOR v_item IN
    SELECT ii.*, m.name AS material_name, m.patrimony_number
    FROM public.inventario_itens ii
    JOIN public.materials m ON m.id = ii.material_id
    WHERE ii.inventario_id = p_inventario_id
      AND ii.status IN ('DIVERGENTE', 'NAO_ENCONTRADO')
  LOOP
    INSERT INTO public.divergences (
      cautela_item_id,
      description,
      status,
      organization_id,
      unit_id,
      reserva_id
    )
    VALUES (
      NULL,
      format(
        'Inventário %s — material %s (patrimônio %s): %s%s',
        p_inventario_id,
        COALESCE(v_item.material_name, v_item.material_id::text),
        COALESCE(v_item.patrimony_number, 'N/A'),
        v_item.status,
        CASE WHEN v_item.observacao IS NOT NULL AND btrim(v_item.observacao) <> ''
          THEN ' — ' || v_item.observacao
          ELSE ''
        END
      ),
      'open',
      v_inv.organization_id,
      v_inv.unit_id,
      v_inv.reserva_id
    );
    v_divergencias_criadas := v_divergencias_criadas + 1;
  END LOOP;

  UPDATE public.inventarios
  SET status = 'FECHADO', closed_at = now(), updated_at = now()
  WHERE id = p_inventario_id;

  RETURN jsonb_build_object(
    'inventario_id', p_inventario_id,
    'status', 'FECHADO',
    'total_itens', v_total,
    'conferidos', v_conferidos,
    'divergentes', v_divergentes,
    'nao_encontrados', v_nao_encontrados,
    'divergencias_criadas', v_divergencias_criadas
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fechar_inventario(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fechar_inventario(UUID) TO authenticated;

COMMENT ON TABLE public.inventarios IS 'Inventário físico de material por reserva (Etapa 6).';
COMMENT ON TABLE public.inventario_itens IS 'Itens conferidos em um inventário físico.';
COMMENT ON FUNCTION public.fechar_inventario(UUID) IS
  'Encerra inventário ABERTO, retorna contagens e registra divergências para itens DIVERGENTE/NAO_ENCONTRADO.';

INSERT INTO public.audit_logs (action, entity, entity_id, after_state, organization_id, unit_id, reserva_id)
SELECT
  'etapa6_inventario_bootstrap',
  'inventarios',
  r.id,
  jsonb_build_object('tables', ARRAY['inventarios', 'inventario_itens']),
  r.organization_id,
  r.unit_id,
  r.id
FROM public.reservas r
WHERE r.code = 'RES-1BPM'
LIMIT 1;
