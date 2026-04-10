-- ========================================
-- Add extended attributes to materials table
-- ========================================

ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS size TEXT,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS quantity INTEGER,
  ADD COLUMN IF NOT EXISTS color TEXT;

ALTER TABLE public.materials
  ALTER COLUMN quantity SET DEFAULT 1;

UPDATE public.materials
SET quantity = 1
WHERE quantity IS NULL OR quantity < 1;

ALTER TABLE public.materials
  ALTER COLUMN quantity SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'materials_quantity_check'
      AND conrelid = 'public.materials'::regclass
  ) THEN
    ALTER TABLE public.materials
      ADD CONSTRAINT materials_quantity_check CHECK (quantity > 0);
  END IF;
END $$;