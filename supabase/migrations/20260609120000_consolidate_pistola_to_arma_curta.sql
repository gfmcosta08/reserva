-- Consolida categoria PISTOLA → ARMA CURTA (sem criar materiais novos).
-- Duplicados (mesmo patrimônio/serial/código): mantém ARMA CURTA, remove PISTOLA após repoint em cautela_items.

CREATE OR REPLACE FUNCTION public._is_pistola_category(cat text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(cat)) IN ('pistola', 'pistolas');
$$;

CREATE OR REPLACE FUNCTION public._is_arma_curta_category(cat text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(cat)) = 'arma curta';
$$;

DO $$
DECLARE
  v_repointed int := 0;
  v_items_deleted int := 0;
  v_materials_deleted int := 0;
  v_updated int := 0;
  v_row int := 0;
  rec record;
BEGIN
  -- Pares duplicados por patrimônio (PISTOLA + ARMA CURTA)
  FOR rec IN
    SELECT p.id AS pistol_id, a.id AS arma_id
    FROM public.materials p
    JOIN public.materials a
      ON a.patrimony_number = p.patrimony_number
     AND public._is_arma_curta_category(a.category)
    WHERE public._is_pistola_category(p.category)
      AND p.id <> a.id
  LOOP
    -- Cautela já tem linha para ARMA CURTA: remove linha do PISTOLA
    DELETE FROM public.cautela_items ci
    WHERE ci.material_id = rec.pistol_id
      AND EXISTS (
        SELECT 1 FROM public.cautela_items x
        WHERE x.cautela_id = ci.cautela_id
          AND x.material_id = rec.arma_id
      );
    GET DIAGNOSTICS v_row = ROW_COUNT;
    v_items_deleted := v_items_deleted + v_row;

    -- Demais linhas: repoint para ARMA CURTA
    UPDATE public.cautela_items
    SET material_id = rec.arma_id
    WHERE material_id = rec.pistol_id;
    GET DIAGNOSTICS v_row = ROW_COUNT;
    v_repointed := v_repointed + v_row;

    DELETE FROM public.materials WHERE id = rec.pistol_id;
    GET DIAGNOSTICS v_row = ROW_COUNT;
    v_materials_deleted := v_materials_deleted + v_row;
  END LOOP;

  -- Duplicados por serial (quando preenchido)
  FOR rec IN
    SELECT p.id AS pistol_id, a.id AS arma_id
    FROM public.materials p
    JOIN public.materials a
      ON a.serial_number IS NOT NULL
     AND trim(a.serial_number) <> ''
     AND a.serial_number = p.serial_number
     AND public._is_arma_curta_category(a.category)
    WHERE public._is_pistola_category(p.category)
      AND p.serial_number IS NOT NULL
      AND trim(p.serial_number) <> ''
      AND p.id <> a.id
  LOOP
    DELETE FROM public.cautela_items ci
    WHERE ci.material_id = rec.pistol_id
      AND EXISTS (
        SELECT 1 FROM public.cautela_items x
        WHERE x.cautela_id = ci.cautela_id
          AND x.material_id = rec.arma_id
      );
    GET DIAGNOSTICS v_row = ROW_COUNT;
    v_items_deleted := v_items_deleted + v_row;

    UPDATE public.cautela_items
    SET material_id = rec.arma_id
    WHERE material_id = rec.pistol_id;
    GET DIAGNOSTICS v_row = ROW_COUNT;
    v_repointed := v_repointed + v_row;

    DELETE FROM public.materials WHERE id = rec.pistol_id;
    GET DIAGNOSTICS v_row = ROW_COUNT;
    v_materials_deleted := v_materials_deleted + v_row;
  END LOOP;

  -- Duplicados por código interno
  FOR rec IN
    SELECT p.id AS pistol_id, a.id AS arma_id
    FROM public.materials p
    JOIN public.materials a
      ON a.internal_code = p.internal_code
     AND public._is_arma_curta_category(a.category)
    WHERE public._is_pistola_category(p.category)
      AND p.id <> a.id
  LOOP
    DELETE FROM public.cautela_items ci
    WHERE ci.material_id = rec.pistol_id
      AND EXISTS (
        SELECT 1 FROM public.cautela_items x
        WHERE x.cautela_id = ci.cautela_id
          AND x.material_id = rec.arma_id
      );
    GET DIAGNOSTICS v_row = ROW_COUNT;
    v_items_deleted := v_items_deleted + v_row;

    UPDATE public.cautela_items
    SET material_id = rec.arma_id
    WHERE material_id = rec.pistol_id;
    GET DIAGNOSTICS v_row = ROW_COUNT;
    v_repointed := v_repointed + v_row;

    DELETE FROM public.materials WHERE id = rec.pistol_id;
    GET DIAGNOSTICS v_row = ROW_COUNT;
    v_materials_deleted := v_materials_deleted + v_row;
  END LOOP;

  UPDATE public.materials
  SET category = 'ARMA CURTA',
      updated_at = now()
  WHERE public._is_pistola_category(category);
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, after_state)
  VALUES (
    NULL,
    'category_consolidation_pistola_to_arma_curta',
    'materials',
    gen_random_uuid(),
    jsonb_build_object(
      'from_categories', jsonb_build_array('PISTOLA', 'PISTOLAS'),
      'to_category', 'ARMA CURTA',
      'materials_updated', v_updated,
      'materials_deleted_duplicates', v_materials_deleted,
      'cautela_items_repointed', v_repointed,
      'cautela_items_deleted_conflicts', v_items_deleted
    )
  );
END $$;

DROP FUNCTION IF EXISTS public._is_pistola_category(text);
DROP FUNCTION IF EXISTS public._is_arma_curta_category(text);

COMMENT ON COLUMN public.materials.category IS 'Categoria textual; pistolas usam ARMA CURTA (PISTOLA legado consolidado em 2026-06-09).';
