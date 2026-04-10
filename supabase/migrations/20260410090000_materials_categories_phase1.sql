-- ========================================
-- FASE 1: Compatibilidade + coluna unica de categoria textual
-- ========================================

ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS categories TEXT;

ALTER TABLE public.materials
  ALTER COLUMN categories SET DEFAULT 'Sem Categoria';

DO $$
BEGIN
  IF to_regclass('public.materials') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'materials'
      AND column_name = 'category_id'
  ) AND to_regclass('public.categories') IS NOT NULL THEN
    UPDATE public.materials m
    SET categories = c.name
    FROM public.categories c
    WHERE m.category_id = c.id
      AND (m.categories IS NULL OR btrim(m.categories) = '');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'materials'
      AND column_name = 'category'
  ) THEN
    EXECUTE '
      UPDATE public.materials
      SET categories = NULLIF(btrim(category), '''')
      WHERE (categories IS NULL OR btrim(categories) = '''')
        AND category IS NOT NULL
    ';
  END IF;
END $$;

UPDATE public.materials
SET categories = 'Sem Categoria'
WHERE categories IS NULL OR btrim(categories) = '';

ALTER TABLE public.materials
  ALTER COLUMN categories SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_materials_categories
  ON public.materials (categories);

