-- Unifica categorias na tabela materials (coluna category TEXT).
-- Remove public.categories e category_id.

DROP POLICY IF EXISTS "categories_operator_rw" ON public.categories;

ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS category TEXT;

UPDATE public.materials m
SET category = COALESCE(c.name, 'Geral')
FROM public.categories c
WHERE m.category_id IS NOT NULL AND m.category_id = c.id;

UPDATE public.materials
SET category = 'Geral'
WHERE category IS NULL;

ALTER TABLE public.materials ALTER COLUMN category SET NOT NULL;
ALTER TABLE public.materials ALTER COLUMN category SET DEFAULT 'Geral';

ALTER TABLE public.materials DROP COLUMN IF EXISTS category_id;

DROP TABLE IF EXISTS public.categories;
