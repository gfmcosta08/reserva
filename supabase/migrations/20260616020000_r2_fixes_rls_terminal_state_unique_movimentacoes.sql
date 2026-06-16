-- ============================================================
-- R2 Fixes: Vulnerabilidades RLS (V1/V2/V4/V7/V8),
-- Proteção de estado terminal (B13.3-B13.4),
-- UNIQUE email persons (B7.1), Validação formato email (B7.2),
-- Unique parcial cautela_items (B12/B13.1),
-- Trigger movimentacoes automática (BUG 2)
-- ============================================================

-- ============================================================
-- V1/V2: profiles UPDATE — supervisor só edita perfis da mesma org
-- Antes: is_supervisor() permitia qualquer supervisor editar qualquer perfil
-- Agora: supervisor só edita perfis de usuários da mesma organização
-- ============================================================

DROP POLICY IF EXISTS "profiles_update_self_or_same_reserva" ON public.profiles;

CREATE POLICY "profiles_update_same_org" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = profiles.id
    OR (
      public.is_supervisor()
      AND EXISTS (
        SELECT 1 FROM public.usuarios su
        JOIN public.usuarios tu ON su.organization_id = tu.organization_id
        WHERE su.auth_user_id = auth.uid()
          AND su.is_active
          AND tu.auth_user_id = profiles.id
          AND tu.is_active
      )
    )
  )
  WITH CHECK (
    auth.uid() = profiles.id
    OR (
      public.is_supervisor()
      AND EXISTS (
        SELECT 1 FROM public.usuarios su
        JOIN public.usuarios tu ON su.organization_id = tu.organization_id
        WHERE su.auth_user_id = auth.uid()
          AND su.is_active
          AND tu.auth_user_id = profiles.id
          AND tu.is_active
      )
    )
  );

-- ============================================================
-- V4/V7/V8: user_can_access_reserva — supervisor restringido ao mesmo unit
-- Antes: supervisor acessava qualquer reserva da mesma organização
-- Agora: supervisor só acessa reservas do seu unit
-- Isso afeta TODAS as tabelas que usam user_can_access_reserva:
--   persons, materials, cautelas, cautela_items
-- ============================================================

CREATE OR REPLACE FUNCTION public.user_can_access_reserva(
  p_reserva_id UUID,
  p_unit_id UUID,
  p_organization_id UUID
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.auth_user_id = auth.uid()
      AND u.is_active
      AND (
        (u.role IN ('supervisor', 'admin') AND u.organization_id = p_organization_id AND u.unit_id = p_unit_id)
        OR (u.role = 'operator' AND u.reserva_id = p_reserva_id)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.user_can_access_reserva(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_access_reserva(UUID, UUID, UUID) TO authenticated;

-- ============================================================
-- B13.3-B13.4: Proteção de estado terminal
-- Cautelas: closed/divergent → não pode voltar para open/partial
-- Cautela_items: returned/damaged/missing → não pode voltar para pending
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_status_regression()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'cautelas' THEN
    IF OLD.status IN ('closed', 'divergent') AND NEW.status NOT IN ('closed', 'divergent') THEN
      RAISE EXCEPTION 'Cautela status cannot regress from % to %. Cautela=%.', OLD.status, NEW.status, NEW.id;
    END IF;
  ELSIF TG_TABLE_NAME = 'cautela_items' THEN
    IF OLD.status IN ('returned', 'damaged', 'missing') AND NEW.status = 'pending' THEN
      RAISE EXCEPTION 'Cautela item status cannot regress from % to pending. Item=%.', OLD.status, NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_status_regression() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prevent_status_regression() TO authenticated;

DROP TRIGGER IF EXISTS trg_prevent_cautela_status_regression ON public.cautelas;
CREATE TRIGGER trg_prevent_cautela_status_regression
  BEFORE UPDATE OF status ON public.cautelas
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.prevent_status_regression();

DROP TRIGGER IF EXISTS trg_prevent_item_status_regression ON public.cautela_items;
CREATE TRIGGER trg_prevent_item_status_regression
  BEFORE UPDATE OF status ON public.cautela_items
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.prevent_status_regression();

-- ============================================================
-- B7.1: UNIQUE constraint em persons.email
-- Zero duplicatas confirmadas no banco de teste
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class cl ON c.conrelid = cl.oid
    JOIN pg_namespace n ON cl.relnamespace = n.oid
    WHERE cl.relname = 'persons' AND n.nspname = 'public'
    AND c.conname = 'persons_email_key'
  ) THEN
    IF NOT EXISTS (
      SELECT email FROM public.persons
      WHERE email IS NOT NULL AND email != ''
      GROUP BY email HAVING COUNT(*) > 1
    ) THEN
      ALTER TABLE public.persons ADD CONSTRAINT persons_email_key UNIQUE (email);
    END IF;
  END IF;
END $$;

-- ============================================================
-- B7.2: Validação formato email em persons
-- ============================================================

ALTER TABLE public.persons DROP CONSTRAINT IF EXISTS persons_email_format_check;

ALTER TABLE public.persons
  ADD CONSTRAINT persons_email_format_check
  CHECK (
    email IS NULL
    OR email = ''
    OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  );

-- ============================================================
-- B12/B13.1: Unique parcial — um material só pode ter 1 item pendente/parcial
-- Impede cautela simultânea do mesmo material (race condition)
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS cautela_items_one_pending_per_material
  ON public.cautela_items (material_id)
  WHERE status IN ('pending', 'partial');

-- ============================================================
-- BUG 2: Trigger para gerar movimentacao automaticamente
-- Colunas reais: tipo, status_anterior, status_novo, stock_anterior,
--   stock_novo, quantidade, person_responsavel_id, cautela_id,
--   cautela_item_id, operador_id, observacao, organization_id,
--   unit_id, reserva_id
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_movimentacao_on_item_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cautela_type TEXT;
  v_cautela_org UUID;
  v_cautela_unit UUID;
  v_cautela_reserva UUID;
  v_cautela_person_id UUID;
  v_operator_id UUID;
  v_mov_type TEXT;
  v_stock_before INT;
  v_stock_after INT;
  v_status_before TEXT;
  v_status_after TEXT;
  v_qty INT;
BEGIN
  SELECT c.type, c.organization_id, c.unit_id, c.reserva_id, c.person_id, c.operator_id
  INTO v_cautela_type, v_cautela_org, v_cautela_unit, v_cautela_reserva, v_cautela_person_id, v_operator_id
  FROM public.cautelas c
  WHERE c.id = COALESCE(NEW.cautela_id, OLD.cautela_id);

  v_operator_id := COALESCE(auth.uid(), v_operator_id);

  IF TG_OP = 'INSERT' THEN
    IF v_cautela_type = 'permanent' THEN
      v_mov_type := 'CAUTELA_PERMANENTE';
    ELSE
      v_mov_type := 'CAUTELA_SAIDA';
    END IF;

    SELECT stock_quantity, status_atual INTO v_stock_before, v_status_before
    FROM public.materials WHERE id = NEW.material_id;

    INSERT INTO public.movimentacoes (
      material_id, tipo, status_anterior, status_novo,
      stock_anterior, stock_novo, quantidade,
      person_responsavel_id, cautela_id, cautela_item_id,
      operador_id, observacao,
      organization_id, unit_id, reserva_id
    ) VALUES (
      NEW.material_id,
      v_mov_type::public.tipo_movimentacao,
      COALESCE(v_status_before, 'DISPONIVEL')::public.status_material,
      CASE WHEN v_cautela_type = 'permanent' THEN 'CAUTELADO_PERMANENTE' ELSE 'CAUTELADO_TEMPORARIO' END::public.status_material,
      COALESCE(v_stock_before, 0),
      GREATEST(COALESCE(v_stock_before, 0) - NEW.quantity_delivered, 0),
      NEW.quantity_delivered,
      v_cautela_person_id,
      NEW.cautela_id,
      NEW.id,
      v_operator_id,
      'Cautela ' || v_cautela_type || ' criada',
      v_cautela_org, v_cautela_unit, v_cautela_reserva
    );

  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'returned' THEN
      v_mov_type := 'CAUTELA_ENTRADA';
    ELSIF NEW.status = 'damaged' THEN
      v_mov_type := 'MANUTENCAO';
    ELSIF NEW.status = 'missing' THEN
      v_mov_type := 'EXTRAVIO';
    ELSE
      RETURN COALESCE(NEW, OLD);
    END IF;

    v_qty := COALESCE(NEW.quantity_returned, 0) - COALESCE(OLD.quantity_returned, 0);
    IF v_qty <= 0 THEN v_qty := COALESCE(NEW.quantity_delivered, 1); END IF;

    SELECT stock_quantity, status_atual INTO v_stock_before, v_status_before
    FROM public.materials WHERE id = NEW.material_id;

    CASE NEW.status
      WHEN 'returned' THEN v_status_after := 'DISPONIVEL';
      WHEN 'damaged' THEN v_status_after := 'MANUTENCAO';
      WHEN 'missing' THEN v_status_after := 'EXTRAVIADO';
      ELSE v_status_after := COALESCE(v_status_before, 'DISPONIVEL');
    END CASE;

    INSERT INTO public.movimentacoes (
      material_id, tipo, status_anterior, status_novo,
      stock_anterior, stock_novo, quantidade,
      person_responsavel_id, cautela_id, cautela_item_id,
      operador_id, observacao,
      organization_id, unit_id, reserva_id
    ) VALUES (
      NEW.material_id,
      v_mov_type::public.tipo_movimentacao,
      COALESCE(v_status_before, 'DISPONIVEL')::public.status_material,
      v_status_after::public.status_material,
      COALESCE(v_stock_before, 0),
      CASE WHEN NEW.status = 'returned' THEN COALESCE(v_stock_before, 0) + v_qty ELSE COALESCE(v_stock_before, 0) END,
      v_qty,
      v_cautela_person_id,
      NEW.cautela_id,
      NEW.id,
      v_operator_id,
      'Item ' || NEW.status || ' (de ' || OLD.status || ')',
      v_cautela_org, v_cautela_unit, v_cautela_reserva
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.generate_movimentacao_on_item_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_movimentacao_on_item_change() TO authenticated;

DROP TRIGGER IF EXISTS trg_generate_movimentacao ON public.cautela_items;
CREATE TRIGGER trg_generate_movimentacao
  AFTER INSERT OR UPDATE OF status ON public.cautela_items
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_movimentacao_on_item_change();

-- ============================================================
-- Comentários
-- ============================================================

COMMENT ON FUNCTION public.prevent_status_regression() IS
  'B13.3-B13.4: Impede regressao de status — cautela closed/divergent nao volta, item returned/damaged/missing nao volta para pending.';

COMMENT ON FUNCTION public.generate_movimentacao_on_item_change() IS
  'BUG 2: Gera movimentacao automaticamente quando cautela_item e criado ou tem status alterado.';

COMMENT ON TRIGGER trg_prevent_cautela_status_regression ON public.cautelas IS
  'Protecao de estado terminal: cautela closed/divergent nao pode regredir.';

COMMENT ON TRIGGER trg_prevent_item_status_regression ON public.cautela_items IS
  'Protecao de estado terminal: item returned/damaged/missing nao pode voltar a pending.';

COMMENT ON INDEX cautela_items_one_pending_per_material IS
  'B12/B13.1: Garante que um material so pode ter 1 cautela_item pendente por vez — impede cautela simultanea.';
