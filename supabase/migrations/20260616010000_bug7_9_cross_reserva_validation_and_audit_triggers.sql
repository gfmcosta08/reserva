-- BUG 7-9: Trigger de validação cross-reserva em cautela_items
-- Garante que reserva_id do item é consistente com a cautela e o material.
-- Impede contaminação cross-reserva via API REST direta.

-- ============================================================
-- BUG 7: cautela_items.reserva_id deve coincidir com cautelas.reserva_id
-- BUG 8: cautela_items.reserva_id deve coincidir com materials.reserva_id
-- BUG 9: cautelas.reserva_id deve coincidir com persons.reserva_id (person da mesma reserva)
-- ============================================================

-- BUG 7+8: Validar consistência de reserva_id em cautela_items
CREATE OR REPLACE FUNCTION public.validate_cautela_item_reserva()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cautela_reserva UUID;
  v_material_reserva UUID;
BEGIN
  -- Buscar reserva_id da cautela pai
  SELECT reserva_id INTO v_cautela_reserva
  FROM public.cautelas
  WHERE id = NEW.cautela_id;

  IF v_cautela_reserva IS NULL THEN
    RAISE EXCEPTION 'Cautela pai não encontrada ou sem reserva_id (cautela_id=%).', NEW.cautela_id;
  END IF;

  -- BUG 7: reserva_id do item deve bater com a cautela
  IF NEW.reserva_id IS DISTINCT FROM v_cautela_reserva THEN
    RAISE EXCEPTION 'cautela_items.reserva_id (%) diverge da cautela pai (%). Item=%, Cautela=%.',
      NEW.reserva_id, v_cautela_reserva, NEW.id, NEW.cautela_id;
  END IF;

  -- BUG 8: reserva_id do material deve bater com o item
  SELECT reserva_id INTO v_material_reserva
  FROM public.materials
  WHERE id = NEW.material_id;

  IF v_material_reserva IS NOT NULL AND NEW.reserva_id IS DISTINCT FROM v_material_reserva THEN
    RAISE EXCEPTION 'cautela_items.reserva_id (%) diverge do material (%). Item=%, Material=%.',
      NEW.reserva_id, v_material_reserva, NEW.id, NEW.material_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_cautela_item_reserva() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_cautela_item_reserva() TO authenticated;

DROP TRIGGER IF EXISTS trg_validate_cautela_item_reserva ON public.cautela_items;
CREATE TRIGGER trg_validate_cautela_item_reserva
  BEFORE INSERT OR UPDATE OF cautela_id, material_id, reserva_id ON public.cautela_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_cautela_item_reserva();

-- ============================================================
-- BUG 9: cautelas.reserva_id deve coincidir com persons.reserva_id
-- (A pessoa recebendo a cautela deve pertencer à mesma reserva)
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_cautela_person_same_reserva()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_person_reserva UUID;
BEGIN
  -- Buscar reserva_id da pessoa
  SELECT reserva_id INTO v_person_reserva
  FROM public.persons
  WHERE id = NEW.person_id;

  -- persons pode não ter reserva_id em todos os casos (e.g. civis)
  -- Se a pessoa tem reserva_id, deve coincidir com a cautela
  IF v_person_reserva IS NOT NULL AND NEW.reserva_id IS DISTINCT FROM v_person_reserva THEN
    RAISE EXCEPTION 'cautelas.reserva_id (%) diverge da pessoa (%). Cautela=%, Person=%.',
      NEW.reserva_id, v_person_reserva, NEW.id, NEW.person_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_cautela_person_same_reserva() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_cautela_person_same_reserva() TO authenticated;

DROP TRIGGER IF EXISTS trg_validate_cautela_person_same_reserva ON public.cautelas;
CREATE TRIGGER trg_validate_cautela_person_same_reserva
  BEFORE INSERT OR UPDATE OF person_id, reserva_id ON public.cautelas
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_cautela_person_same_reserva();

-- ============================================================
-- BUG 2/5: Trigger de audit automático para operações bypass
-- Garante audit trail mesmo quando operações são feitas via API REST direta
-- ============================================================

CREATE OR REPLACE FUNCTION public.audit_cautela_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_operator_id UUID;
BEGIN
  v_operator_id := auth.uid();

  IF TG_OP = 'INSERT' THEN
    v_action := COALESCE(NEW.type, 'daily') || '_created';
    INSERT INTO public.audit_logs (user_id, action, entity, entity_id, before_state, after_state, organization_id, unit_id, reserva_id)
    VALUES (
      v_operator_id,
      CASE WHEN NEW.type = 'permanent' THEN 'cautela_created' ELSE 'cautela_created' END,
      'cautelas',
      NEW.id,
      NULL,
      jsonb_build_object(
        'id', NEW.id,
        'person_id', NEW.person_id,
        'type', NEW.type,
        'status', NEW.status,
        'reserva_id', NEW.reserva_id
      ),
      NEW.organization_id,
      NEW.unit_id,
      NEW.reserva_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_action := 'cautela_status_changed';
      INSERT INTO public.audit_logs (user_id, action, entity, entity_id, before_state, after_state, organization_id, unit_id, reserva_id)
      VALUES (
        v_operator_id,
        v_action,
        'cautelas',
        NEW.id,
        jsonb_build_object('status', OLD.status),
        jsonb_build_object('status', NEW.status),
        NEW.organization_id,
        NEW.unit_id,
        NEW.reserva_id
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.audit_cautela_changes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_cautela_changes() TO authenticated;

DROP TRIGGER IF EXISTS trg_audit_cautela_changes ON public.cautelas;
CREATE TRIGGER trg_audit_cautela_changes
  AFTER INSERT OR UPDATE OF status ON public.cautelas
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_cautela_changes();

-- Audit para cautela_items (retornos/danos/extravios via API direta)
CREATE OR REPLACE FUNCTION public.audit_cautela_item_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_operator_id UUID;
  v_action TEXT;
  v_cautela_reserva UUID;
  v_cautela_org UUID;
  v_cautela_unit UUID;
BEGIN
  v_operator_id := auth.uid();

  -- Buscar tenant da cautela pai
  SELECT organization_id, unit_id, reserva_id
  INTO v_cautela_org, v_cautela_unit, v_cautela_reserva
  FROM public.cautelas
  WHERE id = COALESCE(NEW.cautela_id, OLD.cautela_id);

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- Mapear status para ação de audit
    CASE NEW.status
      WHEN 'returned' THEN v_action := 'item_returned';
      WHEN 'damaged'   THEN v_action := 'item_damaged';
      WHEN 'missing'   THEN v_action := 'item_missing';
      WHEN 'partial'   THEN v_action := 'item_partial_return';
      ELSE v_action := 'item_status_changed';
    END CASE;

    INSERT INTO public.audit_logs (user_id, action, entity, entity_id, before_state, after_state, organization_id, unit_id, reserva_id)
    VALUES (
      v_operator_id,
      v_action,
      'cautela_items',
      COALESCE(NEW.id, OLD.id),
      jsonb_build_object('status', OLD.status, 'quantity_returned', OLD.quantity_returned),
      jsonb_build_object('status', NEW.status, 'quantity_returned', NEW.quantity_returned),
      v_cautela_org,
      v_cautela_unit,
      v_cautela_reserva
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.audit_cautela_item_changes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_cautela_item_changes() TO authenticated;

DROP TRIGGER IF EXISTS trg_audit_cautela_item_changes ON public.cautela_items;
CREATE TRIGGER trg_audit_cautela_item_changes
  AFTER UPDATE OF status ON public.cautela_items
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.audit_cautela_item_changes();

-- ============================================================
-- Comentários
-- ============================================================

COMMENT ON FUNCTION public.validate_cautela_item_reserva() IS
  'BUG 7+8: Garante que cautela_items.reserva_id coincide com a cautela pai e o material.';

COMMENT ON FUNCTION public.validate_cautela_person_same_reserva() IS
  'BUG 9: Garante que cautelas.reserva_id coincide com persons.reserva_id (quando definido).';

COMMENT ON FUNCTION public.audit_cautela_changes() IS
  'BUG 2: Audit automático para INSERT/UPDATE em cautelas — cobre operações via API REST direta.';

COMMENT ON FUNCTION public.audit_cautela_item_changes() IS
  'BUG 5: Audit automático para mudança de status em cautela_items — cobre devoluções/danos/extravios via API REST direta.';
