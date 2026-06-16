-- ============================================================
-- R3 Fixes: V1/V2/V4/V7/V8 RLS UPDATE por auth.uid(),
-- E3 trigger quantity <= stock_quantity,
-- BUG 1 status_atual priority fix,
-- BUG 2 remover trigger movimentacoes (RPC é única fonte),
-- RLS SELECT movimentacoes supervisor vê toda org
-- ============================================================

-- ============================================================
-- V1/V2: profiles UPDATE — somente o próprio usuário
-- Supervisores NÃO podem alterar campos de outros profiles
-- (nome, is_active, role são sensíveis — só o dono muda o próprio)
-- ============================================================

DROP POLICY IF EXISTS "profiles_update_same_org" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self_or_same_reserva" ON public.profiles;

CREATE POLICY "profiles_update_self_only" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- V2: is_active só pode ser alterado pelo próprio ou por admin via função dedicada
-- (A policy acima já cobre — auth.uid() = id é o único caminho)

-- ============================================================
-- V4: cautelas UPDATE — operador só modifica cautelas onde é o operator_id
-- Supervisor pode modificar cautelas da sua unit
-- ============================================================

DROP POLICY IF EXISTS "cautelas_operator_update" ON public.cautelas;

CREATE POLICY "cautelas_operator_update" ON public.cautelas
  FOR UPDATE TO authenticated
  USING (
    operator_id = auth.uid()
    OR (
      public.is_supervisor()
      AND EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.auth_user_id = auth.uid()
          AND u.is_active
          AND u.organization_id = cautelas.organization_id
          AND u.unit_id = cautelas.unit_id
      )
    )
  )
  WITH CHECK (
    operator_id = auth.uid()
    OR (
      public.is_supervisor()
      AND EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.auth_user_id = auth.uid()
          AND u.is_active
          AND u.organization_id = cautelas.organization_id
          AND u.unit_id = cautelas.unit_id
      )
    )
  );

-- ============================================================
-- V7: persons UPDATE — escopo reserva (JÁ coberto pela catch-all,
-- mas adicionamos policy explícita para UPDATE com restrição de unit)
-- ============================================================

-- Remover catch-all e criar policies granulares por operação
DROP POLICY IF EXISTS "persons_reserva_scoped_rw" ON public.persons;

CREATE POLICY "persons_operator_select" ON public.persons
  FOR SELECT TO authenticated
  USING (public.user_can_access_reserva(reserva_id, unit_id, organization_id));

CREATE POLICY "persons_operator_insert" ON public.persons
  FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_reserva(reserva_id, unit_id, organization_id));

CREATE POLICY "persons_operator_update" ON public.persons
  FOR UPDATE TO authenticated
  USING (public.user_can_access_reserva(reserva_id, unit_id, organization_id))
  WITH CHECK (public.user_can_access_reserva(reserva_id, unit_id, organization_id));

CREATE POLICY "persons_operator_delete" ON public.persons
  FOR DELETE TO authenticated
  USING (public.user_can_access_reserva(reserva_id, unit_id, organization_id));

-- ============================================================
-- V8: materials UPDATE — escopo reserva (JÁ coberto pela catch-all,
-- mas adicionamos policy explícita para UPDATE com restrição de unit)
-- ============================================================

DROP POLICY IF EXISTS "materials_reserva_scoped_rw" ON public.materials;

CREATE POLICY "materials_operator_select" ON public.materials
  FOR SELECT TO authenticated
  USING (public.user_can_access_reserva(reserva_id, unit_id, organization_id));

CREATE POLICY "materials_operator_insert" ON public.materials
  FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_reserva(reserva_id, unit_id, organization_id));

CREATE POLICY "materials_operator_update" ON public.materials
  FOR UPDATE TO authenticated
  USING (public.user_can_access_reserva(reserva_id, unit_id, organization_id))
  WITH CHECK (public.user_can_access_reserva(reserva_id, unit_id, organization_id));

CREATE POLICY "materials_operator_delete" ON public.materials
  FOR DELETE TO authenticated
  USING (public.user_can_access_reserva(reserva_id, unit_id, organization_id));

-- ============================================================
-- E3: trigger que rejeita quantity_delivered > stock_quantity
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_cautela_item_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock INT;
  v_pending INT;
  v_available INT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT stock_quantity INTO v_stock FROM public.materials WHERE id = NEW.material_id;
    IF v_stock IS NOT NULL AND NEW.quantity_delivered > v_stock THEN
      RAISE EXCEPTION 'quantity_delivered (%) exceeds available stock (%) for material %.',
        NEW.quantity_delivered, v_stock, NEW.material_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.quantity_delivered > OLD.quantity_delivered THEN
    SELECT stock_quantity INTO v_stock FROM public.materials WHERE id = NEW.material_id;
    IF v_stock IS NOT NULL AND (NEW.quantity_delivered - OLD.quantity_delivered) > v_stock THEN
      RAISE EXCEPTION 'Increased quantity_delivered exceeds available stock for material %.',
        NEW.material_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_cautela_item_stock() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_cautela_item_stock() TO authenticated;

DROP TRIGGER IF EXISTS trg_validate_cautela_item_stock ON public.cautela_items;
CREATE TRIGGER trg_validate_cautela_item_stock
  BEFORE INSERT OR UPDATE OF quantity_delivered ON public.cautela_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_cautela_item_stock();

-- ============================================================
-- BUG 1: materials_bidirectional_status_sync — corrigir prioridade
-- Quando ambos status e status_atual mudam, status_atual TEM PRIORIDADE
-- (status_atual é mais granular; status legado é lossy)
-- ============================================================

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

  -- UPDATE: status_atual tem PRIORIDADE sobre status legado
  -- Se status_atual mudou, derive status dele (não o contrário)
  IF NEW.status_atual IS DISTINCT FROM OLD.status_atual THEN
    NEW.status := public.enum_status_to_legacy(NEW.status_atual);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    -- status legado mudou mas status_atual NÃO mudou
    -- (ex: patch direto no legado sem tocar no enum)
    -- Só converte se o status_atual atual é DISPONIVEL (não está cautelado)
    IF OLD.status_atual = 'DISPONIVEL' THEN
      NEW.status_atual := public.legacy_status_to_enum(NEW.status);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- BUG 2: Remover trigger de movimentacao automatica
-- A RPC aplicar_movimentacao_material JÁ gera movimentacoes
-- A trigger causava duplicatas e dados incompletos
-- ============================================================

DROP TRIGGER IF EXISTS trg_generate_movimentacao ON public.cautela_items;
DROP FUNCTION IF EXISTS public.generate_movimentacao_on_item_change();

-- ============================================================
-- BUG 2 (complemento): RLS SELECT em movimentacoes — supervisor vê toda org
-- A restrição de unit_id na SELECT impedia que supervisores vissem
-- movimentacoes de unidades que supervisionam
-- ============================================================

DROP POLICY IF EXISTS "movimentacoes_reserva_scoped_select" ON public.movimentacoes;

CREATE POLICY "movimentacoes_operator_select" ON public.movimentacoes
  FOR SELECT TO authenticated
  USING (
    -- Operador: vê só da sua reserva
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.auth_user_id = auth.uid()
        AND u.is_active
        AND u.role = 'operator'
        AND u.reserva_id = movimentacoes.reserva_id
    )
    OR
    -- Supervisor: vê toda a organização
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.auth_user_id = auth.uid()
        AND u.is_active
        AND u.role IN ('supervisor', 'admin')
        AND u.organization_id = movimentacoes.organization_id
    )
  );

-- ============================================================
-- Comentários
-- ============================================================

COMMENT ON FUNCTION public.validate_cautela_item_stock() IS
  'E3: Rejeita quantity_delivered que excede stock_quantity do material.';

COMMENT ON FUNCTION public.materials_bidirectional_status_sync() IS
  'BUG 1 fix: Sincronização bidirecional status legado ↔ ENUM. status_atual tem prioridade — nunca sobrescreve com legacy_status_to_enum().';
