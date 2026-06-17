-- R4: Correções QA Round 6
-- V8: Prevenir ALTERAÇÃO cruzada de reserva/unit em materials
-- BUG 9.2: Melhorar audit trigger para lidar com auth.uid() NULL (service_role)
-- BUG 10: Refresh PostgREST schema cache para expor RPCs

-- ============================================================
-- V8: Trigger que rejeita mudança de reserva_id para outra unit,
--     mudança de unit_id para unit de outra organization,
--     e mudança de organization_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_material_reserva_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_unit_id UUID;
  v_new_org_id UUID;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Bloquear mudança de organization_id
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
      RAISE EXCEPTION 'MATERIAL_ORG_CHANGE_BLOCKED: organization_id não pode ser alterado (era %, tentou %)', OLD.organization_id, NEW.organization_id;
    END IF;

    -- Bloquear mudança de unit_id para unit de outra organization
    IF NEW.unit_id IS DISTINCT FROM OLD.unit_id THEN
      SELECT organization_id INTO v_new_org_id
      FROM public.units
      WHERE id = NEW.unit_id;

      IF v_new_org_id IS DISTINCT FROM OLD.organization_id THEN
        RAISE EXCEPTION 'MATERIAL_UNIT_CHANGE_BLOCKED: novo unit_id pertence a outra organization';
      END IF;
    END IF;

    -- Bloquear mudança de reserva_id para reserva de outra unit
    IF NEW.reserva_id IS DISTINCT FROM OLD.reserva_id AND NEW.reserva_id IS NOT NULL THEN
      SELECT unit_id, organization_id INTO v_new_unit_id, v_new_org_id
      FROM public.reservas
      WHERE id = NEW.reserva_id;

      IF v_new_unit_id IS DISTINCT FROM OLD.unit_id THEN
        RAISE EXCEPTION 'MATERIAL_RESERVA_CHANGE_BLOCKED: novo reserva_id pertence a outra unit (era unit %, tentou unit %)', OLD.unit_id, v_new_unit_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_material_reserva_consistency ON public.materials;
CREATE TRIGGER trg_validate_material_reserva_consistency
  BEFORE UPDATE ON public.materials
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_material_reserva_consistency();

REVOKE ALL ON FUNCTION public.validate_material_reserva_consistency() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_material_reserva_consistency() TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_material_reserva_consistency() TO service_role;

COMMENT ON FUNCTION public.validate_material_reserva_consistency() IS
  'V8: Rejeita mudança de materials.organization_id, unit_id para outra org, e reserva_id para outra unit';

-- ============================================================
-- BUG 9.2: Melhorar audit_cautela_item_changes para lidar com
--           auth.uid() NULL (service_role) — usa operator_id da
--           cautela como fallback
-- ============================================================
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

  -- Se auth.uid() é NULL (service_role ou chamada interna),
  -- buscar operator_id da cautela como fallback
  IF v_operator_id IS NULL THEN
    SELECT operator_id INTO v_operator_id
    FROM public.cautelas
    WHERE id = COALESCE(NEW.cautela_id, OLD.cautela_id);
  END IF;

  -- Buscar tenant da cautela pai
  SELECT organization_id, unit_id, reserva_id
  INTO v_cautela_org, v_cautela_unit, v_cautela_reserva
  FROM public.cautelas
  WHERE id = COALESCE(NEW.cautela_id, OLD.cautela_id);

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
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

-- também melhorar audit_cautela_changes com fallback para NULL auth.uid()
CREATE OR REPLACE FUNCTION public.audit_cautela_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_action TEXT;
  v_operator_id UUID;
BEGIN
  v_operator_id := auth.uid();

  IF v_operator_id IS NULL THEN
    v_operator_id := COALESCE(NEW.operator_id, OLD.operator_id);
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := COALESCE(NEW.type, 'daily') || '_created';
    INSERT INTO public.audit_logs (user_id, action, entity, entity_id, before_state, after_state, organization_id, unit_id, reserva_id)
    VALUES (
      v_operator_id,
      'cautela_created',
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
$function$;

-- ============================================================
-- BUG 10: NOTIFICAR PostgREST para recarregar schema cache
--          (garante que RPCs como aplicar_movimentacao_material
--           fiquem visíveis via API REST)
-- ============================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- UX RLS: Adicionar RLS UPDATE policy que retorna erro explícito
--          quando alguém tenta editar perfil de outro usuário
-- ============================================================
-- Adicionar RESTRICTIVE policy para profiles que bloqueia
--       UPDATE de perfis de outros usuários (retorna 403 em vez de no-op)
CREATE POLICY profiles_restrict_cross_user_update ON public.profiles
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Mesmo para persons: bloquear UPDATE de persons de outra reserva
CREATE POLICY persons_restrict_cross_reserva_update ON public.persons
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.auth_user_id = auth.uid()
        AND u.is_active
        AND (
          (u.role IN ('supervisor', 'admin') AND u.organization_id = persons.organization_id AND u.unit_id = persons.unit_id)
          OR (u.role = 'operator' AND u.reserva_id = persons.reserva_id)
        )
    )
  );

-- Mesmo para materials: bloquear UPDATE de materials de outra reserva
CREATE POLICY materials_restrict_cross_reserva_update ON public.materials
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.auth_user_id = auth.uid()
        AND u.is_active
        AND (
          (u.role IN ('supervisor', 'admin') AND u.organization_id = materials.organization_id AND u.unit_id = materials.unit_id)
          OR (u.role = 'operator' AND u.reserva_id = materials.reserva_id)
        )
    )
  );

COMMENT ON POLICY profiles_restrict_cross_user_update ON public.profiles IS
  'V8-R4: RESTRICTIVE — retorna 403 explícito quando usuário tenta editar perfil de outro (antes era no-op silencioso 204)';

COMMENT ON POLICY persons_restrict_cross_reserva_update ON public.persons IS
  'V8-R4: RESTRICTIVE — retorna 403 explícito quando operador tenta editar person de outra reserva';

COMMENT ON POLICY materials_restrict_cross_reserva_update ON public.materials IS
  'V8-R4: RESTRICTIVE — retorna 403 explícito quando operador tenta editar material de outra reserva';