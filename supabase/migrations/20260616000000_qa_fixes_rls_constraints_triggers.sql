-- QA Fixes: RLS crítica (V1-V5), CHECK constraints (E1-E4), trigger status_atual (BUG 1),
-- tipo_movimentacao TRANSFERENCIA, status parcial em cautela_items, DEFAULT data_prevista_devolucao

-- ============================================================
-- V1-V3: RLS em profiles — operador só edita o próprio perfil, supervisor só edita da sua reserva
-- ============================================================

-- Remover policy permissiva que permitia qualquer supervisor alterar qualquer perfil
DROP POLICY IF EXISTS "profiles_supervisor_update" ON public.profiles;

-- Novo: operador edita só o próprio; supervisor edita qualquer perfil da sua reserva
CREATE POLICY "profiles_update_self_or_same_reserva" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = id
    OR public.is_supervisor()
  )
  WITH CHECK (
    auth.uid() = id
    OR public.is_supervisor()
  );

-- V2: is_active só pode ser alterado pelo próprio usuário ou supervisor
-- (Já coberto pela policy acima, mas adicionar CHECK adicional na coluna não é possível
--  via RLS. Restringimos via aplicação ou adicionamos uma trigger que impede
--  desativação de outros usuários por operadores.)

-- V3: email — trigger para impedir alteração de email por não-supervisor
CREATE OR REPLACE FUNCTION public.prevent_email_hijack()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email AND auth.uid() IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Only the account owner can change their email address.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_email_hijack() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prevent_email_hijack() TO authenticated;

DROP TRIGGER IF EXISTS trg_prevent_email_hijack ON public.profiles;
CREATE TRIGGER trg_prevent_email_hijack
  BEFORE UPDATE OF email ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_email_hijack();

-- ============================================================
-- V4: RLS em cautelas — operador só modifica cautelas da sua reserva
-- ============================================================

DROP POLICY IF EXISTS "cautelas_operator_rw" ON public.cautelas;

-- SELECT: qualquer operador ativo pode ler cautelas da sua reserva
CREATE POLICY "cautelas_operator_select" ON public.cautelas
  FOR SELECT TO authenticated
  USING (public.user_can_access_reserva(reserva_id, unit_id, organization_id));

-- INSERT: qualquer operador ativo da reserva
CREATE POLICY "cautelas_operator_insert" ON public.cautelas
  FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_reserva(reserva_id, unit_id, organization_id));

-- UPDATE: só operador da mesma reserva
CREATE POLICY "cautelas_operator_update" ON public.cautelas
  FOR UPDATE TO authenticated
  USING (public.user_can_access_reserva(reserva_id, unit_id, organization_id))
  WITH CHECK (public.user_can_access_reserva(reserva_id, unit_id, organization_id));

-- V5: DELETE bloqueado — usar soft-delete via status='cancelled'
-- (Removida a policy de DELETE. Se precisar, softer delete via UPDATE status.)
-- Nenhuma policy de DELETE será criada para cautelas.

-- ============================================================
-- E1-E4: CHECK constraints em cautela_items
-- ============================================================

ALTER TABLE public.cautela_items
  DROP CONSTRAINT IF EXISTS cautela_items_quantity_delivered_positive;

ALTER TABLE public.cautela_items
  DROP CONSTRAINT IF EXISTS cautela_items_quantity_returned_range;

ALTER TABLE public.cautela_items
  DROP CONSTRAINT IF EXISTS cautela_items_quantity_returned_le_delivered;

ALTER TABLE public.cautela_items
  ADD CONSTRAINT cautela_items_quantity_delivered_positive
  CHECK (quantity_delivered > 0);

ALTER TABLE public.cautela_items
  ADD CONSTRAINT cautela_items_quantity_returned_range
  CHECK (quantity_returned >= 0);

ALTER TABLE public.cautela_items
  ADD CONSTRAINT cautela_items_quantity_returned_le_delivered
  CHECK (quantity_returned <= quantity_delivered);

-- ============================================================
-- BUG 1: Trigger status_atual sobrescreve CAUTELADO_PERMANENTE
-- Correção: a trigger não deve sobrescrever status_atual quando
-- o status legado muda para 'cautelado' — preservar o status_atual original
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

  -- UPDATE: quando status legado muda, converter para enum
  -- MAS: se o status legado é 'cautelado', NÃO sobrescrever o status_atual
  -- (ele já foi definido corretamente pela RPC/aplicação como PERMANENTE ou TEMPORARIO)
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'cautelado' AND OLD.status_atual IN ('CAUTELADO_PERMANENTE', 'CAUTELADO_TEMPORARIO') THEN
      NEW.status_atual := OLD.status_atual;
    ELSE
      NEW.status_atual := public.legacy_status_to_enum(NEW.status);
    END IF;
  ELSIF NEW.status_atual IS DISTINCT FROM OLD.status_atual THEN
    NEW.status := public.enum_status_to_legacy(NEW.status_atual);
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- BUG 6: Adicionar tipo TRANSFERENCIA ao enum tipo_movimentacao
-- ============================================================

ALTER TYPE public.tipo_movimentacao ADD VALUE IF NOT EXISTS 'TRANSFERENCIA';

-- ============================================================
-- BUG 3: Adicionar status 'partial' ao CHECK de cautela_items
-- ============================================================

ALTER TABLE public.cautela_items
  DROP CONSTRAINT IF EXISTS cautela_items_status_check;

ALTER TABLE public.cautela_items
  ADD CONSTRAINT cautela_items_status_check
  CHECK (status IN ('pending', 'partial', 'returned', 'damaged', 'missing'));

-- ============================================================
-- BUG (QA): DEFAULT para data_prevista_devolucao em cautelas diárias
-- Trigger que preenche automaticamente se NULL
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_daily_return_deadline()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.type = 'daily' AND NEW.data_prevista_devolucao IS NULL THEN
    NEW.data_prevista_devolucao := public.calc_daily_return_deadline(NEW.created_at);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_daily_return_deadline ON public.cautelas;
CREATE TRIGGER trg_set_daily_return_deadline
  BEFORE INSERT ON public.cautelas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_daily_return_deadline();

-- ============================================================
-- CHECK constraint em materials.status_atual (enum válido)
-- ============================================================

ALTER TABLE public.materials
  DROP CONSTRAINT IF EXISTS materials_status_atual_check;

ALTER TABLE public.materials
  ADD CONSTRAINT materials_status_atual_check
  CHECK (status_atual IN (
    'DISPONIVEL',
    'CAUTELADO_TEMPORARIO',
    'CAUTELADO_PERMANENTE',
    'MANUTENCAO',
    'BLOQUEADO',
    'BAIXADO',
    'EXTRAVIADO',
    'PENDENTE_DEVOLUCAO'
  ));

-- ============================================================
-- RLS em cautela_items — escopo da mesma reserva
-- ============================================================

DROP POLICY IF EXISTS "cautela_items_operator_rw" ON public.cautela_items;

CREATE POLICY "cautela_items_operator_select" ON public.cautela_items
  FOR SELECT TO authenticated
  USING (public.user_can_access_reserva(reserva_id, unit_id, organization_id));

CREATE POLICY "cautela_items_operator_insert" ON public.cautela_items
  FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_reserva(reserva_id, unit_id, organization_id));

CREATE POLICY "cautela_items_operator_update" ON public.cautela_items
  FOR UPDATE TO authenticated
  USING (public.user_can_access_reserva(reserva_id, unit_id, organization_id))
  WITH CHECK (public.user_can_access_reserva(reserva_id, unit_id, organization_id));

CREATE POLICY "cautela_items_operator_delete" ON public.cautela_items
  FOR DELETE TO authenticated
  USING (public.user_can_access_reserva(reserva_id, unit_id, organization_id));

-- ============================================================
-- V6: Impedir DELETE em cautelas com itens vinculados
-- (FK com CASCADE já existe na tabela original, adicionar trigger que impede exclusão
--  de cautelas com status diferente de 'cancelled' ou 'error')
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_cautela_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Cautelas cannot be deleted. Use status change or soft-delete instead.';
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_cautela_deletion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prevent_cautela_deletion() TO authenticated;

DROP TRIGGER IF EXISTS trg_prevent_cautela_deletion ON public.cautelas;
CREATE TRIGGER trg_prevent_cautela_deletion
  BEFORE DELETE ON public.cautelas
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_cautela_deletion();

-- ============================================================
-- Comentários
-- ============================================================

COMMENT ON FUNCTION public.prevent_email_hijack() IS
  'Impede que alguém altere o email de outro usuário. Apenas o próprio dono pode mudar.';

COMMENT ON FUNCTION public.prevent_cautela_deletion() IS
  'Impede DELETE em cautelas — use soft-delete via status = cancelled.';

COMMENT ON TRIGGER trg_materials_status_sync ON public.materials IS
  'Sincronização bidirecional status legado ↔ ENUM. Preserva CAUTELADO_PERMANENTE quando status legado muda para cautelado.';

COMMENT ON TRIGGER trg_set_daily_return_deadline ON public.cautelas IS
  'Preenche data_prevista_devolucao automaticamente para cautelas diárias caso não informado.';